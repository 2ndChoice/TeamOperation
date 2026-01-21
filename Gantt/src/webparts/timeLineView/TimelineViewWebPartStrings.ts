import { IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

/**
 * A localized text resource.
 */
export interface ITimelineViewWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  DescriptionFieldLabel: string;
  OwnerSequenceFieldLabel: string;
  OwnerSequenceFieldDescription: string;
}

export const TimelineViewWebPartStrings: ITimelineViewWebPartStrings = {
  PropertyPaneDescription: 'Configure timeline view settings',
  BasicGroupName: 'Properties',
  DescriptionFieldLabel: 'Description',
  OwnerSequenceFieldLabel: 'Owner Sequence',
  OwnerSequenceFieldDescription: 'Comma-separated list of owners to display in order (e.g. "Alice, Bob, Charlie")'
};

export default TimelineViewWebPartStrings;
