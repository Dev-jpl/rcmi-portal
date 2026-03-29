export interface BibleBook {
    name: string
    chapters: number
    /** Standard Bible book number (Genesis=1 ... Revelation=66), used by bolls.life API */
    code: number
    testament: 'OT' | 'NT'
}

export const BIBLE_BOOKS: BibleBook[] = [
    // Old Testament
    { name: 'Genesis', chapters: 50, code: 1, testament: 'OT' },
    { name: 'Exodus', chapters: 40, code: 2, testament: 'OT' },
    { name: 'Leviticus', chapters: 27, code: 3, testament: 'OT' },
    { name: 'Numbers', chapters: 36, code: 4, testament: 'OT' },
    { name: 'Deuteronomy', chapters: 34, code: 5, testament: 'OT' },
    { name: 'Joshua', chapters: 24, code: 6, testament: 'OT' },
    { name: 'Judges', chapters: 21, code: 7, testament: 'OT' },
    { name: 'Ruth', chapters: 4, code: 8, testament: 'OT' },
    { name: '1 Samuel', chapters: 31, code: 9, testament: 'OT' },
    { name: '2 Samuel', chapters: 24, code: 10, testament: 'OT' },
    { name: '1 Kings', chapters: 22, code: 11, testament: 'OT' },
    { name: '2 Kings', chapters: 25, code: 12, testament: 'OT' },
    { name: '1 Chronicles', chapters: 29, code: 13, testament: 'OT' },
    { name: '2 Chronicles', chapters: 36, code: 14, testament: 'OT' },
    { name: 'Ezra', chapters: 10, code: 15, testament: 'OT' },
    { name: 'Nehemiah', chapters: 13, code: 16, testament: 'OT' },
    { name: 'Esther', chapters: 10, code: 17, testament: 'OT' },
    { name: 'Job', chapters: 42, code: 18, testament: 'OT' },
    { name: 'Psalms', chapters: 150, code: 19, testament: 'OT' },
    { name: 'Proverbs', chapters: 31, code: 20, testament: 'OT' },
    { name: 'Ecclesiastes', chapters: 12, code: 21, testament: 'OT' },
    { name: 'Song of Solomon', chapters: 8, code: 22, testament: 'OT' },
    { name: 'Isaiah', chapters: 66, code: 23, testament: 'OT' },
    { name: 'Jeremiah', chapters: 52, code: 24, testament: 'OT' },
    { name: 'Lamentations', chapters: 5, code: 25, testament: 'OT' },
    { name: 'Ezekiel', chapters: 48, code: 26, testament: 'OT' },
    { name: 'Daniel', chapters: 12, code: 27, testament: 'OT' },
    { name: 'Hosea', chapters: 14, code: 28, testament: 'OT' },
    { name: 'Joel', chapters: 3, code: 29, testament: 'OT' },
    { name: 'Amos', chapters: 9, code: 30, testament: 'OT' },
    { name: 'Obadiah', chapters: 1, code: 31, testament: 'OT' },
    { name: 'Jonah', chapters: 4, code: 32, testament: 'OT' },
    { name: 'Micah', chapters: 7, code: 33, testament: 'OT' },
    { name: 'Nahum', chapters: 3, code: 34, testament: 'OT' },
    { name: 'Habakkuk', chapters: 3, code: 35, testament: 'OT' },
    { name: 'Zephaniah', chapters: 3, code: 36, testament: 'OT' },
    { name: 'Haggai', chapters: 2, code: 37, testament: 'OT' },
    { name: 'Zechariah', chapters: 14, code: 38, testament: 'OT' },
    { name: 'Malachi', chapters: 4, code: 39, testament: 'OT' },

    // New Testament
    { name: 'Matthew', chapters: 28, code: 40, testament: 'NT' },
    { name: 'Mark', chapters: 16, code: 41, testament: 'NT' },
    { name: 'Luke', chapters: 24, code: 42, testament: 'NT' },
    { name: 'John', chapters: 21, code: 43, testament: 'NT' },
    { name: 'Acts', chapters: 28, code: 44, testament: 'NT' },
    { name: 'Romans', chapters: 16, code: 45, testament: 'NT' },
    { name: '1 Corinthians', chapters: 16, code: 46, testament: 'NT' },
    { name: '2 Corinthians', chapters: 13, code: 47, testament: 'NT' },
    { name: 'Galatians', chapters: 6, code: 48, testament: 'NT' },
    { name: 'Ephesians', chapters: 6, code: 49, testament: 'NT' },
    { name: 'Philippians', chapters: 4, code: 50, testament: 'NT' },
    { name: 'Colossians', chapters: 4, code: 51, testament: 'NT' },
    { name: '1 Thessalonians', chapters: 5, code: 52, testament: 'NT' },
    { name: '2 Thessalonians', chapters: 3, code: 53, testament: 'NT' },
    { name: '1 Timothy', chapters: 6, code: 54, testament: 'NT' },
    { name: '2 Timothy', chapters: 4, code: 55, testament: 'NT' },
    { name: 'Titus', chapters: 3, code: 56, testament: 'NT' },
    { name: 'Philemon', chapters: 1, code: 57, testament: 'NT' },
    { name: 'Hebrews', chapters: 13, code: 58, testament: 'NT' },
    { name: 'James', chapters: 5, code: 59, testament: 'NT' },
    { name: '1 Peter', chapters: 5, code: 60, testament: 'NT' },
    { name: '2 Peter', chapters: 3, code: 61, testament: 'NT' },
    { name: '1 John', chapters: 5, code: 62, testament: 'NT' },
    { name: '2 John', chapters: 1, code: 63, testament: 'NT' },
    { name: '3 John', chapters: 1, code: 64, testament: 'NT' },
    { name: 'Jude', chapters: 1, code: 65, testament: 'NT' },
    { name: 'Revelation', chapters: 22, code: 66, testament: 'NT' },
]

export function getBookByName(name: string): BibleBook | undefined {
    return BIBLE_BOOKS.find((b) => b.name === name)
}

export function getBookByCode(code: number): BibleBook | undefined {
    return BIBLE_BOOKS.find((b) => b.code === code)
}
