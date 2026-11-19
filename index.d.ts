export type PlatformId = "tiktok" | "youtube-shorts" | "instagram-reels" | "facebook-reels" | "all";
export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
/** The area an app leaves clear. From railTop down, a button column moves the right edge in to railLeft. */
export type SafeBox = { left: number; right: number; top: number; bottom: number; railTop: number; railLeft: number };
export type Margins = { top: number; bottom: number; left: number; right: number; buttonColumn?: { fromY: number; width: number } };
export type Source = { publisher: string; title: string; url: string; checked: string };

type StoredMargins = { top: number; bottom: number; left: number; right: number; buttonColumn?: { fromY: number; toY: number; width: number } };
type Zone = { name: string; box: SafeBox; margins: StoredMargins; clearRects: Rect[] };
type Platform = Zone & { covers: string[]; sources: Source[]; variant?: string };
type Wide = { percent: number; pixels: string; box: { left: number; right: number; top: number; bottom: number } };

export declare const safeZones: {
  name: string;
  version: string;
  frame: Size;
  units: string;
  boxShape: string;
  note: string;
  platforms: Record<Exclude<PlatformId, "all">, Platform>;
  clearOnEvery: Zone & { how: string };
  wide16x9: { frame: Size; actionSafe: Wide; titleSafe: Wide; sources: Source[] };
};

export declare const lengthLimits: {
  name: string;
  version: string;
  platforms: Array<{
    id: Exclude<PlatformId, "all">;
    name: string;
    maxSeconds: number | null;
    rule: string;
    sources: Source[];
    adsMaxSeconds?: number;
    recommendedToNewAudiencesUpToSeconds?: number;
    apiMinSeconds?: number;
    apiMaxSeconds?: number;
  }>;
};

export declare const textLimits: {
  name: string;
  version: string;
  platforms: Array<{
    id: Exclude<PlatformId, "all">;
    name: string;
    titleMax?: number;
    descriptionMax?: number;
    captionMax?: number | null;
    hashtags?: { max: number; over: string };
    apiHashtagsMax?: number;
    counting?: string;
    note?: string;
    sources: Source[];
  }>;
};

export declare const speakingRates: {
  name: string;
  version: string;
  rates: Array<{ id: "slow" | "normal" | "fast"; wpm: number; what: string; source: Source }>;
  hookSeconds: number;
  hookNote: string;
};

export declare const platformIds: PlatformId[];
export declare function hasButtonColumn(box: SafeBox): boolean;
export declare function safeBox(platform?: PlatformId, size?: Size): SafeBox;
export declare function marginsOf(box: SafeBox, size?: Size): Margins;
export declare function checkRect(rect: Rect, platform?: PlatformId, size?: Size): { clear: boolean; platform: string; problems: string[] };
export declare function centredSpan(bottom: number, platform?: PlatformId, size?: Size): { left: number; right: number; width: number };
export declare function overlaySvg(platform?: PlatformId, size?: Size, options?: { grid?: boolean }): string;
export declare function wordsFor(seconds: number): Array<{ id: "slow" | "normal" | "fast"; wpm: number; words: number }>;
export declare function round(value: number, places?: number): number;
