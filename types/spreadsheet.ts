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

export type CellFormat = {
  bold: boolean;
  italic: boolean;
  color: string;
};

export type ActiveUser = {
  uid: string;
  name: string;
  color: string;
  lastSeenAt: number;
};

export type CreateDocumentInput = {
  title: string;
  authorName: string;
};
