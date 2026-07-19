const lastHeartbeat = new Date("2026-07-18T17:03:19.252Z");
const now = new Date();
const diffMs = now.getTime() - lastHeartbeat.getTime();
const diffSecs = diffMs / 1000;
console.log({ diffSecs });
if (diffSecs < 30) {
  console.log('ONLINE');
} else if (diffSecs >= 30 && diffSecs < 60) {
  console.log('WARNING');
} else {
  console.log('OFFLINE');
}
