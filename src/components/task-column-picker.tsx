"use client";

import { Columns3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TASK_COLUMNS, type TaskColumnKey } from "@/lib/types";

export function TaskColumnPicker({
  visible,
  onToggle,
}: {
  visible: TaskColumnKey[];
  onToggle: (key: TaskColumnKey) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="secondary-button" />}>
        <Columns3 size={14} /> Colunas
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TASK_COLUMNS.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.key}
              checked={visible.includes(column.key)}
              onCheckedChange={() => onToggle(column.key)}
              onSelect={(event) => event.preventDefault()}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
