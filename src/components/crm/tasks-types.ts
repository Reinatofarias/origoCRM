import type { Lead, Task } from "@/lib/types";

export type TaskInput = {
  lead_id: string | null;
  type: Task["type"];
  title: string;
  notes: string | null;
  due_at: string;
};

export type TaskScope = "open" | "overdue" | "today" | "upcoming" | "completed";

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
