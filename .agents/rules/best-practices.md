---
trigger: always_on
---

## Best Practices.

- Do not repeat yourself. Two or more, use a function or use a for. If something has to be parsed repeatedly, place it in a config file (JSON5 recommended) instead of hardcoding it within business logic, using composable patterns.
- Ensure your files are compatible with JSDoc auto-generators, and have a .bat script that ensures the automatic generation of documentation.
- Files not mentioned or used anywhere should be deleted unless they serve a framework or data processing purpose.
- Files should not exceed 1000LOC in length. If they do, they should be split up into multiple files logically.
- If logical flow must be strongly preserved, like in data processing pipelines, it is recommended by CRD to prefix each step with a letter, i.e. A\_<function_key>, etc.

## Writing.

CTD uses non-Oxford British English (EN-GB) as its main writing system. Times are expressed in 24-hour format from GMT (UTC+0). For digital clocks, this is equivalent to Reykjavík Time. Measurements should generally be given in metric. Official locales supported by CRD/CTD are EN-GB, FR, and DE.

Dates are formatted with the full month in d Month YYYY format, i.e. 15 March 2026 or 6 June 2026. Years may be specified as either AD or BC for historical purposes. We do not use CE or BCE since they have different character lengths. Confoederatio Timestamps are measured in minutes from 1 January 1AD, 00:00 (GMT) as 64-bit floats. Triennial leap years are specified as \[-45, -42, -39, -36, -33, -30, -27, -24, -21, -18, -15, -12, -9\] (Ideler 1825), with the Julian-Gregorian transition implemented in spec.

Written numbers should be formatted using European decimals, 58,88; 50.403,28, using semicolons to separate them in human-readable lists. Numeric abbreviations are semantic, not SI: k for thousands, M for millions, B for billions, and T for trillions, and so on. 

For financial amounts, you may occasionally see mn, bn, and tn. The baseline currency for research used by CRD is the International Dollar (FY2000), and the Special Drawing Right (SDR) in some American contexts.

For technical writing, ensure that your comments are Doxygen/Javadoc/JSDoc and locale compatible.