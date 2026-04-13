export interface Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  category: 'work' | 'personal' | 'meeting' | 'other';
  priority: 'low' | 'medium' | 'high';
  files?: AttachedFile[];
  tasks?: Task[];
}

export interface AttachedFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Task {
  id: string;
  title: string;
  dueDate: Date;
  completed: boolean;
  assignedFileId?: string;
}

export interface AIResponse {
  type: 'event' | 'task' | 'query' | 'error';
  data?: any;
  message: string;
}
