# Gear Wide (h1 and h2)

`src/fonts.ts` registers every file in this folder as the "Gear Wide" family and reads weight and style from the
file name (`Slant`, `Italic` or `Oblique` means italic). The site uses it for all h1 and h2 headings
(`--font-display` in `assets/site.css`).

Currently in this folder: the **Gear Trial Wide** files (Regular and Regular Slant), converted from the supplied
OTF files to woff2. The trial only contains 72 characters: A–Z, a–z, 0–9, space, `! , . ? @` and curly quotes.
Any other character in a heading (a hyphen, an ampersand, an accented letter) falls back to Inter.

Trial fonts are for testing only. Buy a web licence before the site goes public, then replace these files with
the licensed ones. The loader needs no change as long as the file names still say the weight and style.
