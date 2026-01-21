import { SPHttpClient } from '@microsoft/sp-http';

export interface ITask {
  id: string;
  name: string;
  owner: string;
  start: Date;
  end: Date;
  progress: number;
  custom_class?: string;
}

export interface ITimelineViewProps {
  description: string;
  listId?: string;
  listURL?: string;
  titleColumn?: string;
  ownerColumn?: string;
  startDateColumn?: string;
  endDateColumn?: string;
  webUrl: string;
  spHttpClient: SPHttpClient;
  ownerSequence?: string; 
}

