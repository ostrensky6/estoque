// Code39 barcode como SVG puro (sem dependências). Suficiente para etiquetas
// de lote escaneáveis em laboratório. Code39 é maiúsculo + dígitos + alguns
// símbolos; caracteres não suportados são removidos.

const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw",
  C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn",
  G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww",
  O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn",
  S: "nnwnnnwwn", T: "nnnnwnwwn", U: "wwnnnnnnw", V: "nwwnnnnnw",
  W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", $: "nwnwnwnnn",
  "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn", "*": "nwnnwnwnn",
};

export function Barcode39({
  value,
  height = 48,
  narrow = 2,
  className,
}: {
  value: string;
  height?: number;
  narrow?: number;
  className?: string;
}) {
  const wide = narrow * 3;
  const clean = (value || "")
    .toUpperCase()
    .split("")
    .filter((c) => c in CODE39 && c !== "*")
    .join("");
  const seq = `*${clean}*`;

  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < seq.length; i++) {
    const pattern = CODE39[seq[i]];
    for (let j = 0; j < pattern.length; j++) {
      const w = pattern[j] === "w" ? wide : narrow;
      if (j % 2 === 0) bars.push({ x, w }); // posições pares = barras
      x += w;
    }
    x += narrow; // gap entre caracteres
  }
  const width = x;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Código de barras ${clean}`}
    >
      <rect x={0} y={0} width={width} height={height} fill="#fff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />
      ))}
    </svg>
  );
}
