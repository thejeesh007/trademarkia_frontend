export type SpreadsheetDocument = {
  id: string;
  title: string;
  authorName: string;
  updatedAt: number;
};

export type CellValue = {
  raw: string;
  computed: string;
};

export type ActiveUser = {
  uid: string;
  name: string;
  color: string;
  lastSeenAt: number;
};
