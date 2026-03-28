function getChannelBitAllocation(maxColors: number): [number, number, number] {
  const safeMaxColors = Math.max(1, Math.floor(maxColors));
  const totalBits = Math.max(0, Math.floor(Math.log2(safeMaxColors)));
  const channelBits: [number, number, number] = [0, 0, 0];

  for (let index = 0; index < totalBits; index += 1) {
    channelBits[index % 3] += 1;
  }

  return channelBits;
}

function quantizeChannel(value: number, bits: number): number {
  if (bits <= 0) {
    return 128;
  }

  const levels = 2 ** bits;
  const level = Math.round((value / 255) * (levels - 1));
  return Math.round((level / (levels - 1)) * 255);
}

export function quantizeRgbaBufferToMaxColors(
  source: Uint8ClampedArray,
  maxColors: number,
): Uint8ClampedArray {
  const [redBits, greenBits, blueBits] = getChannelBitAllocation(maxColors);
  const quantized = new Uint8ClampedArray(source);

  for (let index = 0; index < quantized.length; index += 4) {
    if (quantized[index + 3] === 0) {
      continue;
    }

    quantized[index] = quantizeChannel(quantized[index], redBits);
    quantized[index + 1] = quantizeChannel(quantized[index + 1], greenBits);
    quantized[index + 2] = quantizeChannel(quantized[index + 2], blueBits);
  }

  return quantized;
}
