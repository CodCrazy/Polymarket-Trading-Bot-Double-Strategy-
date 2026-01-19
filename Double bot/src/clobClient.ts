import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables from .env at project root
dotenv.config();

const DEFAULT_HOST = "https://clob.polymarket.com";
const DEFAULT_CHAIN_ID = 137; // Polygon mainnet

let cachedClient: ClobClient | null = null;

export async function getClobClient(): Promise<ClobClient> {
  if (cachedClient) return cachedClient;

  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    throw new Error("PRIVATE_KEY env var is required");
  }

  // Cast to any to avoid version mismatches between ethers typings
  const signer: any = new Wallet(pk as any);
  console.log("signer", signer);

  // const wclient = new ClobClient(
  //   DEFAULT_HOST,
  //   DEFAULT_CHAIN_ID,
  //   signer // Signer enables L1 methods
  // );

  // const wapiCreds = await wclient.createOrDeriveApiKey();
  // console.log("wapiCreds", wapiCreds);

  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_SECRET;
  const apiPassphrase = process.env.API_PASSPHRASE;

  if (!apiKey || !apiSecret || !apiPassphrase) {
    throw new Error(
      "API_KEY, API_SECRET, and API_PASSPHRASE env vars are required"
    );
  }

  const apiCreds = {
    key: apiKey,
    secret: apiSecret,
    passphrase: apiPassphrase,
  };

  // Check if using proxy account (signature type 1 or 2 requires funder address)
  const funderAddress = process.env.FUNDER_ADDRESS;
  const signatureType = 2; // 0 = EOA, 1 = Proxy (Email/Magic), 2 = Proxy (Browser Wallet)

  // ClobClient constructor: (host, chainId, signer, creds, signatureType, funderAddress)
  const client = new ClobClient(
    DEFAULT_HOST,
    DEFAULT_CHAIN_ID,
    signer as any,
    apiCreds,
    signatureType,
    funderAddress // Required for signature type 1 or 2
  );
  cachedClient = client;
  return client;
}
