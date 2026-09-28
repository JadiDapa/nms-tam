"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormField from "../FormField";
import GroupDialog from "./GroupDialog";

export type GroupOption = { id: number; name: string };

type Props = {
  groups: GroupOption[];
  value: number | null | undefined;
  onChange: (groupId: number | null) => void;
  error?: string;
};

const UNGROUPED = "none";

// The "Group" picker shared by the add-device wizard and the settings form: pick an existing group,
// leave it ungrouped, or create a new one inline without leaving the form.
export default function GroupField({ groups, value, onChange, error }: Props) {
  return (
    <FormField label="Group" optional error={error} hint="Where this device shows up on the device list.">
      <div className="flex gap-2">
        <Select value={value ? String(value) : UNGROUPED} onValueChange={(v) => onChange(v === UNGROUPED ? null : Number(v))}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNGROUPED}>No group</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <GroupDialog
          onCreated={(g) => onChange(g.id)}
          trigger={
            <Button type="button" variant="outline" size="icon" aria-label="New group">
              <Plus className="size-4" />
            </Button>
          }
        />
      </div>
    </FormField>
  );
}
