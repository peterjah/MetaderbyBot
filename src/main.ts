import { personalSign } from "@metamask/eth-sig-util";
import axios from "axios";
import { Provider } from "./provider";
import delay from "delay";
import { ethers } from "ethers";
import { writeFileSync } from "fs";
import { raceClass, raceFees } from "./constants";

const API = "https://serv.derby.dbytothemoon.com";
const DERBY_VAULT = "0x3F642AA39962FE7C3A2fb5dEe8a524FE8138ad05";
const LOOP_TIME_MIN = 10;

const provider = new Provider();

let token: string;
const main = async () => {
  let gains = 0;
  while (true) {
    token = await connect();
    let horses: any[] = await listHorses();
    const energy = horses.map((h) => ({
      name: h.horse_name,
      energy: h.energy,
      points: h.points,
    }));
    console.log(energy);
    const horseToRace = horses.filter(
      (h) => h.daily_reward_countdown < 0 || h.energy === 10
    );
    const results = await findRace(horseToRace);
    if (results.length) {
      console.log("results", results);
      gains = results.reduce(
        (acc, r) => acc + r.gain - raceFees[r.class as raceClass],
        gains
      );
      console.log("total gains", gains);
      horses = await listHorses();
      if (horses.some((h) => h.daily_reward_countdown < 0)) {
        continue;
      }
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
    wallet_addr: await provider.adminWallet.getAddress(),
    timestamp: Math.floor(Date.now() / 1000),
  };

  const signature = personalSign({
    privateKey: provider.pkeyBuf,
    data: Buffer.from(JSON.stringify(msg)),
  });

  const login = await axios.post(`${API}/account/launcher`, {
    json_string: JSON.stringify(msg),
    sign: signature,
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
    await delay(3100);
  }

  await Promise.all(
    races.map(async (r) => {
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
        console.log(".", r.name);
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

  for (const race of races) {
    let message;
    let results;
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
      console.log(".", race.name);
      message = match.data.message;
      results = match.data.data;
      await delay(2000);
    }
    race.rank = results.rank;
    const gain = results.Award
      ? parseInt(ethers.utils.formatEther(ethers.BigNumber.from(results.Award)))
      : 0;
    const daily_reward = results.daily_reward
      ? parseInt(
          ethers.utils.formatEther(ethers.BigNumber.from(results.daily_reward))
        )
      : 0;
    race.gain = gain + daily_reward;
    race.mmr = results.delta_point;

    console.log(`${race.name} race_settlement`, results);
    console.log(`${race.name} rank`, results.rank);
    console.log(`${race.name} points`, results.delta_point);
    console.log(`${race.name} gain`, gain);
  }

  return races;
};

// derby withdraw632278
const withdraw = async (hash: number) => {
  const msg = "derby withdraw" + hash;
  console.log("msg", msg);
  const signature = personalSign({
    privateKey: provider.pkeyBuf,
    data: Buffer.from(msg),
  });
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
