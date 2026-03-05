import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneDropdown,
  IPropertyPaneDropdownOption,
  PropertyPaneButton,
  PropertyPaneButtonType
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

import strings from './TimelineViewWebPartStrings';
import TimelineView from './components/TimeLineView';
import { ITimelineViewProps } from './components/ITimeLineViewProps';

export interface ITimelineViewWebPartProps {
  description: string;
  siteUrl?: string;
  listId?: string;
  powerAppURL?: string;
  titleColumn?: string;
  ownerColumn?: string;
  categoryColumn?: string;
  startDateColumn?: string;
  endDateColumn?: string;
  ownerSequence?: string;
  defaultPixelsPerDay?: number;
  minPixelsPerDay?: number;
  maxPixelsPerDay?: number;
  webpartTitle?: string;
}

interface IListInfo {
  Id: string;
  Title: string;
}

interface IColumnInfo {
  InternalName: string;
  Title: string;
  TypeAsString: string;
}

export default class TimelineViewWebPart extends BaseClientSideWebPart<ITimelineViewWebPartProps> {
  private lists: IPropertyPaneDropdownOption[] = [];
  private columns: { [listId: string]: IPropertyPaneDropdownOption[] } = {};
  private loadingLists: boolean = false;
  private _teamsContext: any;

  public render(): void {
    console.log('WebPart render called with properties:', {
      description: this.properties.description,
      listId: this.properties.listId,
      powerAppURL: this.properties.powerAppURL,
      titleColumn: this.properties.titleColumn,
      ownerColumn: this.properties.ownerColumn,
      categoryColumn: this.properties.categoryColumn,
      startDateColumn: this.properties.startDateColumn,
      endDateColumn: this.properties.endDateColumn,
      ownerSequence: this.properties.ownerSequence
    });

    const element: React.ReactElement<ITimelineViewProps> = React.createElement(
      TimelineView,
      {
        description: this.properties.description,
        listId: this.properties.listId,
        powerAppURL: this.properties.powerAppURL || 'https://apps.powerapps.com/play/e/Default-0fee8ff2-a3b2-4018-9c75-3a1d5591fedc/a/06be35db-4ca1-4ac5-8c7b-b1012db6b73c',
        titleColumn: this.properties.titleColumn || 'Title',
        ownerColumn: this.properties.ownerColumn || 'Consultant',
        categoryColumn: this.properties.categoryColumn || 'TripType',
        startDateColumn: this.properties.startDateColumn || 'StartDate',
        endDateColumn: this.properties.endDateColumn || 'EndDate',
        ownerSequence: this.properties.ownerSequence || 'Frank, Tony, Bang, Ning, Zhihao, Naveen, Yong, Heng, Tariq, Harry, Brian, Santhosh',
        defaultPixelsPerDay: this.properties.defaultPixelsPerDay || 20,
        minPixelsPerDay: this.properties.minPixelsPerDay || 5,
        maxPixelsPerDay: this.properties.maxPixelsPerDay || 30,
        webpartTitle: this.properties.webpartTitle || 'Trip Planning (V 3.0)',
        webUrl: this.getSiteUrl(),
        // pass the web part context so that inner components can
        // determine Teams/OAuth state or access pageContext values
        context: this.context,
        spHttpClient: this.context.spHttpClient
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected async onInit(): Promise<void> {
    return super.onInit().then(_ => {
      // Capture Teams context if running in Teams
      this._teamsContext = (this.context as any).sdks?.microsoftTeams?.context;
      console.log('Teams context initialized:', this._teamsContext);
      return this.loadLists();
    });
  }

  // Get the site URL (custom or current)
  private getSiteUrl(): string {
    return this.properties.siteUrl || this.context.pageContext.web.absoluteUrl;
  }

  private async loadLists(): Promise<void> {
    if (this.loadingLists || this.lists.length > 0) return;
    
    this.loadingLists = true;
    try {
      const siteUrl = this.getSiteUrl();
      const apiUrl = `${siteUrl}/_api/web/lists?$filter=Hidden eq false&$select=Id,Title&$orderby=Title`;
      const response: SPHttpClientResponse = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1
      );

      const data = await response.json();
      this.lists = data.value.map((list: IListInfo) => ({
        key: list.Id,
        text: list.Title
      }));

      // If a list is already selected, load its columns
      if (this.properties.listId) {
        await this.loadColumns(this.properties.listId);
      }
    } catch (error) {
      console.error('Error loading lists:', error);
      this.lists = [{ key: '', text: 'Error loading lists' }];
    } finally {
      this.loadingLists = false;
    }
  }

  private async loadColumns(listId: string): Promise<void> {
    if (!listId || this.columns[listId]) return;

    try {
      const siteUrl = this.getSiteUrl();
      const apiUrl = `${siteUrl}/_api/web/lists('${listId}')/fields?$filter=Hidden eq false and ReadOnlyField eq false&$select=InternalName,Title,TypeAsString&$orderby=Title`;
      const response: SPHttpClientResponse = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1
      );

      const data = await response.json();
      console.log('Loaded columns for list:', listId, data.value);
      
      this.columns[listId] = data.value.map((column: IColumnInfo) => ({
        key: column.InternalName,
        text: `${column.Title} (${column.InternalName})`
      }));

      // Auto-set defaults if columns are not configured
      if (!this.properties.titleColumn || !this.properties.ownerColumn || 
          !this.properties.startDateColumn || !this.properties.endDateColumn) {
        const titleCol = data.value.find((c: IColumnInfo) => c.InternalName === 'Title');
        const ownerCol = data.value.find((c: IColumnInfo) => 
          c.TypeAsString.includes('User') || c.InternalName.toLowerCase().includes('owner') || 
          c.InternalName.toLowerCase().includes('assign')
        );
        const startDateCol = data.value.find((c: IColumnInfo) => 
          c.TypeAsString === 'DateTime' && 
          (c.InternalName.toLowerCase().includes('start') || c.InternalName.toLowerCase().includes('begin'))
        );
        const endDateCol = data.value.find((c: IColumnInfo) => 
          c.TypeAsString === 'DateTime' && 
          (c.InternalName.toLowerCase().includes('end') || c.InternalName.toLowerCase().includes('due') || 
           c.InternalName.toLowerCase().includes('finish'))
        );

        this.properties.titleColumn = titleCol?.InternalName || 'Title';
        this.properties.ownerColumn = ownerCol?.InternalName || '';
        this.properties.startDateColumn = startDateCol?.InternalName || '';
        this.properties.endDateColumn = endDateCol?.InternalName || '';
        
        console.log('Auto-set column defaults:', {
          titleColumn: this.properties.titleColumn,
          ownerColumn: this.properties.ownerColumn,
          startDateColumn: this.properties.startDateColumn,
          endDateColumn: this.properties.endDateColumn
        });
      }

      this.context.propertyPane.refresh();
      this.render();
    } catch (error) {
      console.error('Error loading columns:', error);
      this.columns[listId] = [{ key: '', text: 'Error loading columns' }];
    }
  }

  protected onPropertyPaneFieldChanged(propertyPath: string, oldValue: any, newValue: any): void {
    console.log(`Property ${propertyPath} changed from ${oldValue} to ${newValue}`);
    
    if (propertyPath === 'siteUrl' && newValue !== oldValue) {
      // Clear lists and columns when site URL changes
      this.lists = [];
      this.columns = {};
      this.properties.listId = '';
      this.properties.titleColumn = '';
      this.properties.ownerColumn = '';
      this.properties.categoryColumn = '';
      this.properties.startDateColumn = '';
      this.properties.endDateColumn = '';
      this.loadLists().then(() => {
        this.context.propertyPane.refresh();
        this.render();
      });
    } else if (propertyPath === 'listId' && newValue) {
      // Clear column selections when list changes
      this.properties.titleColumn = '';
      this.properties.ownerColumn = '';
      this.properties.categoryColumn = '';
      this.properties.startDateColumn = '';
      this.properties.endDateColumn = '';
      // Load columns for the new list
      this.loadColumns(newValue).then(() => {
        this.context.propertyPane.refresh();
        this.render();
      });
    } else {
      // For any other property change, trigger a re-render
      this.render();
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const selectedListId = this.properties.listId || '';
    const availableColumns = selectedListId ? (this.columns[selectedListId] || []) : [];

    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: 'List Configuration',
              groupFields: [
                PropertyPaneTextField('siteUrl', {
                  label: 'SharePoint Site URL (Optional)',
                  description: 'Leave empty to use current site, or enter the URL of another SharePoint site (e.g., https://tenant.sharepoint.com/sites/mysite)',
                  value: this.properties.siteUrl || 'https://efutureway.sharepoint.com/sites/archive-2020-11-23T230729Z'

                }),
                PropertyPaneDropdown('listId', {
                  label: 'Select SharePoint List',
                  options: this.lists.length > 0 ? this.lists : [{ key: '', text: 'Loading lists...' }],
                  selectedKey: selectedListId
                }),
                PropertyPaneTextField('powerAppURL', {
                  label: 'Power App Form URL',
                  description: 'Enter Power App Form URL for editing',
                  value: this.properties.powerAppURL || 'https://apps.powerapps.com/play/e/Default-0fee8ff2-a3b2-4018-9c75-3a1d5591fedc/a/06be35db-4ca1-4ac5-8c7b-b1012db6b73c',
                  disabled: !selectedListId
                })
              ]
            },
            {
              groupName: 'Column Mapping',
              groupFields: [
                PropertyPaneDropdown('titleColumn', {
                  label: 'Task Title Column',
                  options: availableColumns.length > 0 ? availableColumns : [{ key: '', text: 'Select a list first...' }],
                  selectedKey: this.properties.titleColumn || 'Title',
                  disabled: !selectedListId
                }),
                PropertyPaneDropdown('ownerColumn', {
                  label: 'Owner Column',
                  options: availableColumns.length > 0 ? availableColumns : [{ key: '', text: 'Select a list first...' }],
                  selectedKey: this.properties.ownerColumn || 'Consultant',
                  disabled: !selectedListId
                }),
                PropertyPaneDropdown('categoryColumn', {
                  label: 'Category Column',
                  options: availableColumns.length > 0 ? availableColumns : [{ key: '', text: 'Select a list first...' }],
                  selectedKey: this.properties.categoryColumn || '',
                  disabled: !selectedListId
                }),
                PropertyPaneDropdown('startDateColumn', {
                  label: 'Start Date Column',
                  options: availableColumns.length > 0 ? availableColumns : [{ key: '', text: 'Select a list first...' }],
                  selectedKey: this.properties.startDateColumn || '',
                  disabled: !selectedListId
                }),
                PropertyPaneDropdown('endDateColumn', {
                  label: 'End Date Column',
                  options: availableColumns.length > 0 ? availableColumns : [{ key: '', text: 'Select a list first...' }],
                  selectedKey: this.properties.endDateColumn || '',
                  disabled: !selectedListId
                }),
                PropertyPaneButton('refreshColumns', {
                  text: 'Refresh Columns',
                  buttonType: PropertyPaneButtonType.Primary,
                  onClick: () => {
                    if (selectedListId) {
                      delete this.columns[selectedListId];
                      this.loadColumns(selectedListId).then(() => {
                        this.context.propertyPane.refresh();
                      });
                    }
                  },
                  disabled: !selectedListId
                })
              ]
            },
            {
              groupName: 'View Settings',
              groupFields: [
                PropertyPaneTextField('webpartTitle', {
                  label: strings.WebpartTitleLabel,
                  description: strings.WebpartTitleDescription,
                  value: this.properties.webpartTitle || 'Trip Planning (V 3.0)'
                }),
                PropertyPaneTextField('ownerSequence', {
                  label: strings.OwnerSequenceFieldLabel,
                  description: strings.OwnerSequenceFieldDescription,
                  multiline: true,
                  rows: 5,
                  value: this.properties.ownerSequence || 'Frank, Tony, Bang, Ning, Zhihao, Naveen, Yong, Heng,Tariq, Harry, Brian, Santhosh'
                })
              ]
            },
            {
              groupName: 'Zoom Configuration',
              groupFields: [
                PropertyPaneTextField('defaultPixelsPerDay', {
                  label: strings.DefaultPixelsPerDayLabel,
                  description: strings.DefaultPixelsPerDayDescription,
                  value: (this.properties.defaultPixelsPerDay || 20).toString()
                }),
                PropertyPaneTextField('minPixelsPerDay', {
                  label: strings.MinPixelsPerDayLabel,
                  description: strings.MinPixelsPerDayDescription,
                  value: (this.properties.minPixelsPerDay || 5).toString()
                }),
                PropertyPaneTextField('maxPixelsPerDay', {
                  label: strings.MaxPixelsPerDayLabel,
                  description: strings.MaxPixelsPerDayDescription,
                  value: (this.properties.maxPixelsPerDay || 30).toString()
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
