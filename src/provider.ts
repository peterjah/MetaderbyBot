import { ethers } from "ethers";
import { personalSign } from "@metamask/eth-sig-util";

export class Provider {
  public provider: ethers.providers.JsonRpcProvider;
  public adminWallet: ethers.Wallet;
  public pkeyBuf: Buffer;

  public config: any;

  constructor() {
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      console.error("ADMIN_PRIVATE_KEY not set");
      process.exit();
    }

    this.provider = new ethers.providers.JsonRpcProvider(
      "https://api.avax.network/ext/bc/C/rpc"
    );
    this.adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);

    this.pkeyBuf = Buffer.from(this.adminWallet.privateKey.substring(2), "hex");
  }

  signMessage = (msg: string): string => {
    return personalSign({
      privateKey: this.pkeyBuf,
      data: Buffer.from(msg),
    });
  };
}
