"use client";

import { ActiveUser } from "@/types/spreadsheet";

type ActiveUsersProps = {
  users: ActiveUser[];
  currentUid: string | null;
};

export function ActiveUsers({ users, currentUid }: ActiveUsersProps) {
  if (users.length === 0) {
    return (
      <p className="glass-panel rounded-full px-3 py-1 text-xs font-medium themed-muted">
        Active users: none
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {users.map((user) => (
        <span
          key={user.uid}
          className="glass-panel inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: user.color }} />
          {user.name}
          {user.uid === currentUid ? " (You)" : ""}
        </span>
      ))}
    </div>
  );
}
