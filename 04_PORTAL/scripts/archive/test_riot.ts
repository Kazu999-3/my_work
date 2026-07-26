import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const apiKey = process.env.RIOT_API_KEY;
const puuid = "GB16QNxuvRNmrNG296JTxUTE7GSignV4i9smTfp3tMbnhwigRue1vh44L6p96wDBa_Pz7dZB1dInCA";

async function test() {
  const url = `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${apiKey}`;
  const res = await fetch(url);
  console.log("No type:", res.status, await res.text());

  const url2 = `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&type=custom&api_key=${apiKey}`;
  const res2 = await fetch(url2);
  console.log("Type custom:", res2.status, await res2.text());
}

test().catch(console.error);
