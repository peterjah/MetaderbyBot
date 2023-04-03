import axios from "axios";
import { Provider } from "./provider";
import delay from "delay";
import { ethers } from "ethers";
import { writeFileSync } from "fs";
import { raceClass, raceFees } from "./constants";

const API = "https://serv1.be.dbytothemoon.com/avax";
const DERBY_VAULT = "0x3F642AA39962FE7C3A2fb5dEe8a524FE8138ad05";
const LOOP_TIME_MIN = 10;

const provider = new Provider();

let token: string;
const main = async () => {
  let totalGains = 0;
  while (true) {
    let gains = 0;
    try {
      token = await connect();
      let horses: any[] = await listHorses();
      // console.log(horses)
      const stats = horses.map((h) => ({
        name: h.horse_name,
        energy: h.energy,
        points: h.points,
        dailyRewardGained: h.daily_reward_countdown > 0,
        nextDailyReward:
          h.daily_reward_countdown > 0
            ? new Date(
                Date.now() + h.daily_reward_countdown * 1000
              ).toLocaleString()
            : "-",
        nextEnergy: new Date(
          Date.now() + h.next_energy * 1000
        ).toLocaleTimeString(),
      }));
      console.log(stats);
      const horseToRace = horses.filter(
        (h) => h.daily_reward_countdown < 0 || h.energy >= 10
      );
      const results = await findRace(horseToRace);

      if (results.length) {
        console.log("results", results);
        gains = results.reduce(
          (acc, r) => acc + r.gain - raceFees[r.class as raceClass],
          0
        );
      }
      totalGains += gains;
      console.log(
        `total gains: ${totalGains} (${gains > 0 ? "+" : ""}${gains})`
      );

      if (
        horses.some(
          (h, idx) =>
            h.daily_reward_countdown < 0 &&
            results.length &&
            results.find((r) => r.horseId === h.horse_id)?.rank > 3
        )
      ) {
        console.log("waiting for race end");
        await delay(100 * 1000);
        continue;
      }
    } catch (err: any) {
      console.log("err:", err?.code, err?.message);
    }

    await delay(LOOP_TIME_MIN * 60 * 1000);
  }
};

const buildStats = async () => {
  let data = {};
  const nbHorses = 9060;
  let horseId = 1;
  while (horseId < nbHorses) {
    const racelist = await raceList(horseId);
    if (racelist.list.length) {
      data = {
        ...data,
        [horseId]: racelist.list.map((r: any) => ({
          raceId: r.race_id,
          class: r.class,
          rank: r.rank,
          timestamp: r.start_time,
        })),
      };
    }
    console.log(`horse ${horseId} .total: ${racelist.total}`);
    if (racelist.total > 10000) {
    }
    writeFileSync("stats.json", JSON.stringify(data));
    await delay(111);
    horseId++;
  }
};

const listHorses = async () => {
  const res = await axios.post(
    `${API}/account/list_horses`,
    {},
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        token,
      },
    }
  );
  return res.data.data.Horses;
};

const connect = async (): Promise<string> => {
  const msg = {
    wallet_addr: (await provider.adminWallet.getAddress()).toLowerCase(),
    timestamp: Math.floor(Date.now() / 1000),
    chain_id: 43114,
  };

  const signature = provider.signMessage(JSON.stringify(msg));
  const login = await axios.post(`${API}/account/launcher`, {
    json_string: JSON.stringify(msg),
    sign: signature,
    wallet: "Ethereum"
  });
  return login.data.data.Token;
};

const raceList = async (horse_id: number, pageSize = 1) => {
  const list = await axios.post(
    `${API}/race/race_list`,
    {
      horse_id,
      status: null,
      page: 1,
      page_size: pageSize,
    },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        token,
      },
    }
  );
  return list.data.data;
};

const findRace = async (horses: any[]): Promise<any[]> => {
  const races = [];
  for (const horse of horses) {
    const name = horse.horse_name;
    if (horse.energy < 1) {
      console.log(`${name}: no energy left`);
      continue;
    }
    if (horse.status === "inRace") {
      console.log(`${name}: is already racing`);
      continue;
    }
    console.log("finding race for", name);
    const race = await axios.post(
      `${API}/race/match_race`,
      {
        horse_id: horse.horse_id,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          token,
        },
      }
    );
    const orderId = race.data.data.order_no;
    races.push({
      orderId,
      horseId: horse.horse_id,
      raceId: undefined,
      name,
      rank: 0,
      gain: 0,
      mmr: 0,
      class: horse.class,
    });
    console.log(`${name}: register number: ${orderId}. wait for race start`);
    await delay(2100);
  }

  await Promise.all(
    races.map(async (r) => {
      let n = 1;
      while (!r.raceId) {
        let res;
        try {
          res = await axios.post(
            `${API}/race/search_racing_id`,
            {
              order_id: r.orderId,
            },
            {
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                token,
              },
            }
          );
        } catch (err: any) {
          console.log(err);
          console.log("err?.message", err?.message);
          return;
        }
        const anim = `${r.name} -${" ".repeat(n)}🏇`;
        console.log(anim);
        n++;
        r.raceId = res?.data?.data?.racing_id;
        if (!r.raceId) {
          await delay(2000);
        }
      }
      console.log(
        `${r.name}: race ${r.raceId} started! wait for race settlement`
      );
    })
  );

  await Promise.all(
    races.map(async (race) => {
      let message;
      let results;
      let n = 1;
      while (message !== "success") {
        const match = await axios.post(
          `${API}/race/race_settlement`,
          {
            horse_id: race.horseId,
            racing_id: race.raceId,
          },
          {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              token,
            },
          }
        );
        const anim = `${race.name} -${" ".repeat(n)}🏇`;
        console.log(anim);
        n++;
        message = match.data.message;
        results = match.data.data;
        await delay(5000);
      }
      race.rank = results.rank;
      const gain = results.Award
        ? parseInt(
            ethers.utils.formatEther(ethers.BigNumber.from(results.Award))
          )
        : 0;
      const daily_reward = results.daily_reward
        ? parseInt(
            ethers.utils.formatEther(
              ethers.BigNumber.from(results.daily_reward)
            )
          )
        : 0;
      race.gain = gain + daily_reward;
      race.mmr = results.delta_point;

      // console.log(`${race.name} race_settlement`, results);
    })
  );

  return races;
};

// derby withdraw632278
const withdraw = async (hash: number) => {
  const msg = "derby withdraw" + hash;
  const signature = provider.signMessage(msg);

  const list = await axios.post(
    `${API}/user/wallet_claim`,
    {
      currency: "HOOF",
      hash: hash.toString(),
      signature,
    },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        token,
      },
    }
  );
  return list.data.data;
};
main();
