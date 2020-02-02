export interface NamedObjectInfo {
  pureName: string;
  schemaName: string;
}

export interface ColumnReference {
  columnName: string;
  refColumnName?: string;
}

export interface ConstraintInfo {
  constraintName: string;
  constraintType: string;
}

export interface ColumnsConstraintInfo extends ConstraintInfo {
  columns: ConstraintInfo[];
}

export interface PrimaryKeyInfo extends ColumnsConstraintInfo {}

export interface ForeignKeyInfo extends ColumnsConstraintInfo {
  refSchemaName: string;
  refTableName: string;
  updateAction: string;
  deleteAction: string;
}

export interface ColumnInfo {
  columnName: string;
  notNull: boolean;
  autoIncrement: boolean;
  dataType: string;
  precision: number;
  scale: number;
  length: number;
  computedExpression: string;
  isPersisted: boolean;
  isSparse: boolean;
  defaultValue: string;
  defaultConstraint: string;
}
export interface TableInfo extends NamedObjectInfo {
  columns: ColumnInfo[];
  primaryKey?: PrimaryKeyInfo;
  foreignKeys: ForeignKeyInfo[];
}
export interface DatabaseInfo {
  tables: TableInfo[];
}