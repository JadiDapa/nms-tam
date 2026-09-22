import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { Table } from "@tanstack/react-table";

interface SearchDataTableProps<TData> {
  table: Table<TData>;
  placeholder?: string;
  column: string;
}

export default function SearchDataTable<TData>({
  table,
  placeholder = "Search...",
  column,
}: SearchDataTableProps<TData>) {
  return (
    <div className="relative w-full">
      <Search
        size={18}
        className="text-text-400 absolute left-3 top-1/2 -translate-y-1/2"
      />
      <Input
        placeholder={placeholder}
        value={(table.getColumn(column)?.getFilterValue() as string) ?? ""}
        onChange={(event) =>
          table.getColumn(column)?.setFilterValue(event.target.value)
        }
        className="pl-9"
      />
    </div>
  );
}
