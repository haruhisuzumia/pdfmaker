export type SavedFile = {
  /** content:// URI of the new MediaStore entry. */
  uri: string;
  /** Final display name; MediaStore may append " (1)" on a name collision. */
  name: string;
  size: number;
};
