// Test script for testing the read speeds in correlation with the block size.

import { convertTime, processLargeFile } from "../index.js";

let result = [];

export async function testRead() {
  for (let index = 13000; index <= 17000; index += 200) {
    await processLargeFile(index).then((res) => {
      result.push({
        size: index,
        time: res,
      });
    });
  }
  result = result.sort((r1, r2) => r1.time - r2.time);
  result = result.map((r) => ({ size: r.size, time: convertTime(r.time) }));
  console.log(result);
}
