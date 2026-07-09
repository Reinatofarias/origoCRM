import type { Lead, Task } from "@/lib/types";

export type TaskInput = {
  lead_id: string | null;
  type: Task["type"];
  title: string;
  notes: string | null;
  priority?: NonNullable<Task["priority"]>;
  workflow_status?: NonNullable<Task["workflow_status"]>;
  start_at?: string | null;
  position?: number | null;
  due_at: string;
};

export type TaskScope = "open" | "overdue" | "today" | "upcoming" | "completed";

export type TaskViewMode = "list" | "board" | "calendar";
export type TaskGroupMode = "none" | "status" | "owner" | "lead";
export type TaskSortMode = "due" | "priority" | "status" | "owner";
export type TaskWorkflowStatus = NonNullable<Task["workflow_status"]>;
export type TaskPriority = NonNullable<Task["priority"]>;

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  htmlLink: string | null;
  hangoutLink: string | null;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type GoogleCalendarEventDraft = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  attendees: string;
  createMeet: boolean;
};

export type TaskEditorState = {
  task?: Task | null;
  lead?: Lead | null;
  draft?: Partial<TaskInput>;
};
