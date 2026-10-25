const cryptoLogos: Record<string, string> = {
  BTC: "btc",
  ETH: "eth",
  USDT: "usdt",
  USDC: "usdc",
  BNB: "bnb",
  SOL: "sol",
  EURC: "eurc",
  BTC_LIGHTENING: "lightning",
};
export function cryptoMethodLogo(name: string) {
  const logo = cryptoLogos[name];
  return logo ? `/payment-methods/cryptos/${logo}.svg` : undefined;
}
