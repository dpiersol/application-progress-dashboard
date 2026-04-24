export type Milestone = { name: string; done: boolean };

export type FileEntry = {
  path: string;
  purpose: string;
  createdAt: string;
  createdBy: string;
  modifiedAt: string;
  modifiedBy: string;
};

export type Registry = {
  appName: string;
  progress: {
    phase: string;
    percentComplete: number;
    summary: string;
    milestones: Milestone[];
  };
  files: FileEntry[];
};
