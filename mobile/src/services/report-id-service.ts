const trackingAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createReportId(): string {
  return `RPT-${createReadableToken(5)}`;
}

export function createTrackingId(): string {
  return `SNK-${createReadableToken(5)}`;
}

function createReadableToken(length: number): string {
  let token = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * trackingAlphabet.length);
    token += trackingAlphabet[randomIndex];
  }

  return token;
}
