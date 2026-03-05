import { SPHttpClient } from '@microsoft/sp-http';
// WebPartContext provides typing for the SPFx context object that's
// commonly passed down into React components for helpers like
// `httpClient`, `pageContext`, and Teams SDK access.
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface ITask {
  id: string;
  name: string;
  owner: string;
  category?: string;
  start: Date;
  end: Date;
  progress: number;
  custom_class?: string;
}

export interface ITimelineViewProps {
  description: string;
  listId?: string;
  /**
   * URL of the Power App form used for editing/adding items.  This is
   * no longer used to identify the list itself (listId handles that)
   * but is required when opening the embedded form from the timeline.
   */
  powerAppURL?: string;
  titleColumn?: string;
  ownerColumn?: string;
  categoryColumn?: string;
  startDateColumn?: string;
  endDateColumn?: string;
  webUrl: string;
  spHttpClient: SPHttpClient;
  /**
   * SPFx context object supplied by the web part.  We use this for
   * things like detecting Teams, grabbing the current user's email,
   * or accessing pageContext properties from inside the React tree.
   */
  context: WebPartContext;
  ownerSequence?: string;
  defaultPixelsPerDay?: number;
  minPixelsPerDay?: number;
  maxPixelsPerDay?: number;
  webpartTitle?: string;
}

