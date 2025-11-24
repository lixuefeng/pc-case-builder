export const anchorPoint = (dims, anchor = "center") => {
  const w = Number(dims?.w) || 0;
  const h = Number(dims?.h) || 0;
  const d = Number(dims?.d) || 0;
  const left = -w / 2;
  const right = w / 2;
  const top = h / 2;
  const bottom = -h / 2;
  const back = -d / 2;
  const front = d / 2;

  const has = (k) => anchor.includes(k);
  const x = has("left") ? left : has("right") ? right : 0;
  const y = has("top") ? top : has("bottom") ? bottom : 0;
  const z = has("back") ? back : has("front") ? front : 0;
  return [x, y, z];
};

export const addVec = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const anchorOffset = (dims, anchor, offset = [0, 0, 0]) =>
  addVec(anchorPoint(dims, anchor), offset);
