# Football Legends XI Structure

```txt
football-legends-xi/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── LegendBuilder.tsx
├── data/
│   └── football-legends.md
├── lib/
│   └── legend-data.ts
├── docs/
│   └── STRUCTURE.md
├── next.config.ts
├── package.json
├── README.md
└── tsconfig.json
```

## Notes

- `lib/legend-data.ts` reads and parses `data/football-legends.md` first, with a local workspace fallback for development.
- `components/LegendBuilder.tsx` owns all client-side interaction, squad generation, manual slot overrides, and saved XI state.
- No remote API, external DB, or deployment config is required for the MVP.
