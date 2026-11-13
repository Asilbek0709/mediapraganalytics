import { lugat } from "../til";

export const vaqt = lugat(
  {
    "v.oylar": "yan|fev|mar|apr|may|iyun|iyul|avg|sen|okt|noy|dek",
    "v.chorak": "{r} ch. {y}",
  },
  {
    "v.oylar": "янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек",
    "v.chorak": "{r} кв. {y}",
  },
  {
    "v.oylar": "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec",
    "v.chorak": "Q{q} {y}",
  },
);
