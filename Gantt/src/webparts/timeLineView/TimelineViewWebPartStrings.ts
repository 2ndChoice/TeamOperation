import { IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

/**
 * A localized text resource.
 */
export interface ITimelineViewWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  DescriptionFieldLabel: string;
  WebpartTitleLabel: string;
  WebpartTitleDescription: string;
  OwnerSequenceFieldLabel: string;
  OwnerSequenceFieldDescription: string;
  DefaultPixelsPerDayLabel: string;
  DefaultPixelsPerDayDescription: string;
  MinPixelsPerDayLabel: string;
  MinPixelsPerDayDescription: string;
  MaxPixelsPerDayLabel: string;
  MaxPixelsPerDayDescription: string;
}

export const TimelineViewWebPartStrings: ITimelineViewWebPartStrings = {
  PropertyPaneDescription: 'Configure timeline view settings',
  BasicGroupName: 'Properties',
  DescriptionFieldLabel: 'Description',
  WebpartTitleLabel: 'View Title',
  WebpartTitleDescription: 'Title displayed at the top of the timeline view (default: "Trip Planning (V 2.0)")',
  OwnerSequenceFieldLabel: 'Owner Sequence',
  OwnerSequenceFieldDescription: 'Comma-separated list of owners to display in order (e.g. "Frank, Tony, Ning")',
  DefaultPixelsPerDayLabel: 'Default Zoom Level (Pixels Per Day)',
  DefaultPixelsPerDayDescription: 'Initial zoom level when the view loads (default: 20)',
  MinPixelsPerDayLabel: 'Minimum Zoom Level',
  MinPixelsPerDayDescription: 'Minimum pixels per day when zooming out (default: 5)',
  MaxPixelsPerDayLabel: 'Maximum Zoom Level',
  MaxPixelsPerDayDescription: 'Maximum pixels per day when zooming in (default: 30)'
};

export default TimelineViewWebPartStrings;
