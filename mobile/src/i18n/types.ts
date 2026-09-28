import { en } from "./translations/en";

export type AppLanguage = "en" | "hi" | "as";

type WidenStrings<T> = {
  [Key in keyof T]: T[Key] extends string ? string : WidenStrings<T[Key]>;
};

export type TranslationDictionary = WidenStrings<typeof en>;

type Join<Key, Previous> = Key extends string
  ? Previous extends string
    ? `${Key}.${Previous}`
    : never
  : never;

type LeafKeys<T> = T extends object
  ? {
      [Key in keyof T]: T[Key] extends string
        ? Key
        : Join<Key, LeafKeys<T[Key]>>;
    }[keyof T]
  : never;

export type TranslationKey = LeafKeys<TranslationDictionary>;
