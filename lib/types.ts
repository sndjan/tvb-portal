export type TaskStatus = "open" | "done";

export type ParticipantRecord = {
  id: string;
  taskId: string;
  name: string;
  createdAt: string;
};

export type ImageRecord = {
  id: string;
  taskId: string;
  url: string;
  createdAt: string;
};

export type TaskWithDetails = {
  id: string;
  title: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  durationEstimate: string | null;
  requiredPeople: number | null;
  status: TaskStatus;
  isHidden: boolean;
  createdAt: string;
  participantCount: number;
  participants: ParticipantRecord[] | null;
  images: ImageRecord[];
};

export type TasksResponse = {
  tasks: TaskWithDetails[];
  isAdmin: boolean;
};

export type EmailRecipient = {
  id: string;
  email: string;
};

export type CreateTaskFormState = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  durationEstimate: string;
  requiredPeople: string;
  status: TaskStatus;
  isHidden: boolean;
  sendEmail: boolean;
};

export type EditTaskFormState = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  durationEstimate: string;
  requiredPeople: string;
  status: TaskStatus;
  isHidden: boolean;
};

export type PendingUpload = {
  files: File[];
  previews: string[];
};

export type BusyTask = {
  id: string;
  busy: boolean;
  busyAction: Action;
};

export enum Action {
  ToggleStatus = "toggle_status",
  ToggleVisibility = "toggle_visibility",
  SaveEdit = "save_edit",
  DeleteTask = "delete_task",
  UploadImages = "upload_images",
  DeleteImage = "delete_image",
}
