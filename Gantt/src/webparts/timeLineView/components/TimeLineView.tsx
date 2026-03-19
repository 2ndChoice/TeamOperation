import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './TimeLineView.module.scss';
import { ITask, ITimelineViewProps } from './ITimeLineViewProps';
import TimelineRenderer, { ITimelineRendererHandle } from './TimelineRenderer';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { Icon } from '@fluentui/react/lib/Icon';
import { Panel, PanelType } from '@fluentui/react/lib/Panel';
import { useConfirm } from '../../useConfirm';
import { authentication } from "@microsoft/teams-js";
import { TaskForm } from './TaskForm';

export interface ITimelineViewState {
  tasks: ITask[];
  groupedTasks: { [owner: string]: ITask[] };
  loading: boolean;
  pixelsPerDay: number;
  error: string | null;
  chartStartDate: Date | null;
  isPanelOpen: boolean;
  editingTask: Partial<ITask> | null;
} 

const TimelineViewConstants = {
  ZOOM_STEP: 1,
  DAYS_IN_A_WEEK: 7,
  API_ITEM_LIMIT: 5000,
  MILLISECONDS_PER_DAY: 1000 * 60 * 60 * 24,
  BUTTON_SIZE: 28
};

const TimelineView: React.FC<ITimelineViewProps> = (props) => {
  const rendererRef = React.useRef<ITimelineRendererHandle | null>(null);
  
  // Get zoom configuration from props with fallback to defaults
  const defaultPixelsPerDay = props.defaultPixelsPerDay || 20;
  const minPixelsPerDay = props.minPixelsPerDay || 5;
  const maxPixelsPerDay = props.maxPixelsPerDay || 30;
  
  const [state, setState] = useState<ITimelineViewState>({
    tasks: [],
    groupedTasks: {},
    loading: true,
    pixelsPerDay: defaultPixelsPerDay,
    error: null,
    chartStartDate: new Date(new Date().getFullYear(), 0, 1),
    isPanelOpen: false,
    editingTask: null
    });


  // Fetch tasks from SharePoint
  const fetchTasks = useCallback(async () => {
    console.log('=== fetchTasks called ===');
    console.log('Props:', {
      tripListId: props.tripListId,
      destinationListId: props.destinationListId,
      titleColumn: props.titleColumn,
      ownerColumn: props.ownerColumn,
      categoryColumn: props.categoryColumn,
      startDateColumn: props.startDateColumn,
      endDateColumn: props.endDateColumn
    });

    if (!props.tripListId) {
      console.warn('No list selected');
      setState(prev => ({ ...prev, loading: false, error: 'Please select a list' }));
      return;
    }

    const titleCol = props.titleColumn;
    const ownerCol = props.ownerColumn;
    const categoryCol = props.categoryColumn;
    const startDateCol = props.startDateColumn;
    const endDateCol = props.endDateColumn;

    if (!titleCol || !ownerCol || !categoryCol || !startDateCol || !endDateCol) {
      console.error('Required columns not configured');
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Please configure all required columns (Title, Owner, Category, Start Date, End Date)'
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // tripListId is required by the validation logic above, so use it
      const listSelector = `lists('${props.tripListId}')`;

      const selectFields = ['ID', titleCol];
      if (ownerCol) {
        selectFields.push(ownerCol);
      }
      if (categoryCol) {
        selectFields.push(categoryCol);
      }
      selectFields.push(startDateCol, endDateCol);
      
      // For lookup fields, select the ID and the expanded text value (assuming it looks up 'Title')
      // selectFields.push('DestinationId', 'Destination/Title', 'TRNumber', 'Cost');
      selectFields.push('DestinationId', 'Destination/Title', 'TRNumber', 'Cost');

      const selectQuery = selectFields.join(',');
      
      // Build filter for start date if specified
      let filterQuery = '';
      if (state.chartStartDate) {
        const filterDate = state.chartStartDate.toISOString();
        filterQuery = `&$filter=${startDateCol} ge datetime'${filterDate}'`;
      }
      
      const apiUrl = `${props.webUrl}/_api/web/${listSelector}/items?$select=${selectQuery}&$expand=Destination${filterQuery}&$orderby=${startDateCol} asc&$top=${TimelineViewConstants.API_ITEM_LIMIT}`;

      console.log('Fetching from URL:', apiUrl);

      const response: SPHttpClientResponse = await props.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        throw new Error(`Failed to fetch: ${response.status} , query: ${apiUrl}, error: ${errorText}`);
      }

      const data = await response.json();
      console.log('API response:', data);

      if (!data.value || data.value.length === 0) {
        console.warn('No items found');
        setState(prev => ({
          ...prev,
          tasks: [],
          groupedTasks: {},
          loading: false,
          error: 'No items found in the list'
        }));
        return;
      }

      // Map items to tasks
      const tasks: ITask[] = data.value.map((item: any) => {
        const title = item[titleCol] || 'Untitled Task';
        
        let owner = 'Unassigned';
        if (ownerCol && item[ownerCol]) {
          const ownerValue = item[ownerCol];
          if (typeof ownerValue === 'string') {
            owner = ownerValue;
          } else if (typeof ownerValue === 'object' && ownerValue.Title) {
            owner = ownerValue.Title;
          } else {
            owner = String(ownerValue);
          }
        }

        let category: string | undefined;
        if (categoryCol && item[categoryCol]) {
          category = item[categoryCol];
        }

        let startDate = new Date();
        let endDate = new Date(startDate.getTime() + TimelineViewConstants.DAYS_IN_A_WEEK * TimelineViewConstants.MILLISECONDS_PER_DAY);

        if (item[startDateCol]) {
          try {
            startDate = new Date(item[startDateCol]);
            startDate.setHours(0, 0, 0, 0);
          } catch (e) {
            console.warn('Failed to parse start date:', item[startDateCol]);
          }
        }

        if (item[endDateCol]) {
          try {
            endDate = new Date(item[endDateCol]);
            endDate.setHours(0, 0, 0, 0);
          } catch (e) {
            console.warn('Failed to parse end date:', item[endDateCol]);
          }
        }

        return {
          id: item.ID?.toString() || item.Id?.toString() || '0',
          name: title,
          owner: owner,
          category: category,
          start: startDate,
          end: endDate,
          destination: item.Destination ? item.Destination.Title : '',
          destinationId: item.DestinationId,
          trNumber: item.TRNumber,
          cost: item.Cost?.toString(),
          progress: 0,
          custom_class: ''
        } as ITask;
      });

      // Group tasks by owner and sort by start date
      const grouped: { [owner: string]: ITask[] } = {};
      tasks.forEach(task => {
        if (!grouped[task.owner]) {
          grouped[task.owner] = [];
        }
        grouped[task.owner].push(task);
      });

      // Sort tasks within each owner by start date
      Object.keys(grouped).forEach(owner => {
        grouped[owner].sort((a, b) => a.start.getTime() - b.start.getTime());
      });

      console.log('✓ Tasks loaded:', tasks.length);
      console.log('✓ Grouped by owner:', Object.keys(grouped).map(o => ({ owner: o, count: grouped[o].length })));

      setState(prev => ({
        ...prev,
        tasks,
        groupedTasks: grouped,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Error loading tasks: ${error instanceof Error ? error.message : String(error)}`
      }));
    }
  }, [props.tripListId, props.titleColumn, props.ownerColumn, props.categoryColumn, props.startDateColumn, props.endDateColumn, props.webUrl, props.spHttpClient, state.chartStartDate]);

  const updateTaskDate = async (taskId: string, start: Date, end: Date) => {
    console.log('Updating task:', taskId, start, end);
  };

  const onDismissPanel = React.useCallback(() => {
    console.log('onDismissPanel called');
    setState(prev => ({ ...prev, isPanelOpen: false, editingTask: null }));
    // Save scroll position in renderer before refreshing tasks
    try {
      rendererRef.current?.saveScrollPosition();
    } catch (e) {}
    fetchTasks();
  }, [fetchTasks]);

  const handleSaveTask = async (task: Partial<ITask>) => {
    const { tripListId, webUrl, spHttpClient, titleColumn, ownerColumn, categoryColumn, startDateColumn, endDateColumn } = props;

    if (!tripListId) return;

    // Optimistically close the panel immediately so the user doesn't have to wait
    setState(prev => ({ ...prev, isPanelOpen: false, editingTask: null }));

    const listSelector = `lists('${tripListId}')`;
    let apiUrl = `${webUrl}/_api/web/${listSelector}/items`;
    const headers: any = {};
    
    const body: any = {};
    if (titleColumn && task.name) body[titleColumn] = task.name;
    if (ownerColumn && task.owner) body[ownerColumn] = task.owner;
    if (categoryColumn && task.category) body[categoryColumn] = task.category;
    if (startDateColumn && task.start) body[startDateColumn] = task.start.toISOString();
    if (endDateColumn && task.end) body[endDateColumn] = task.end.toISOString();

    const extendedTask = task as any;
    
    // Save the ID for Lookup columns
    if (extendedTask.destinationId) body['DestinationId'] = extendedTask.destinationId;
    if (extendedTask.trNumber) body['TRNumber'] = extendedTask.trNumber;
    if (extendedTask.cost) body['Cost'] = extendedTask.cost;

    let response: SPHttpClientResponse;

    try {
      if (task.id) {
        apiUrl += `(${task.id})`;
        headers['IF-MATCH'] = '*';
        headers['X-HTTP-Method'] = 'MERGE';
        response = await spHttpClient.post(apiUrl, SPHttpClient.configurations.v1, {
          headers: headers,
          body: JSON.stringify(body)
        });
      } else {
        response = await spHttpClient.post(apiUrl, SPHttpClient.configurations.v1, {
          headers: headers,
          body: JSON.stringify(body)
        });
      }

      if (response.ok) {
        fetchTasks();
      } else {
        const errorText = await response.text();
        console.error('API error:', errorText);
        alert(`Failed to save task. Error: ${errorText}`);
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error saving task. Please check the console for details.');
    }
  };


  // Fetch tasks on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Refresh tasks when window gets focus (e.g. returning from the Power App form)
  useEffect(() => {
    const handleFocus = () => {
      try {
        rendererRef.current?.saveScrollPosition();
      } catch (e) {}
      fetchTasks();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchTasks]);

  const handleAddTask = (date: Date, owner: string) => {
    setState(prev => ({ 
      ...prev, 
      isPanelOpen: true, 
      editingTask: { start: date, owner: owner } 
    }));
  };

  const handleModifyTask = (task: ITask) => {
    setState(prev => ({ 
      ...prev, 
      isPanelOpen: true, 
      editingTask: task 
    }));
  };

  // Hook calls must be at the top level of the component
  const { confirm, ConfirmDialog } = useConfirm();


  const handleDeleteTask = async (task: ITask) => {
    
    const ok = await confirm("Delete record", `Are you sure you want to delete "${task.name}"?`);
    
    if (!ok) return;

    try {
      const listSelector = `lists('${props.tripListId}')`;         
      const apiUrl = `${props.webUrl}/_api/web/${listSelector}/items(${task.id})`;
          
      const response = await props.spHttpClient.post(
        apiUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'X-HTTP-Method': 'DELETE',
            'IF-MATCH': '*'
          }
        }
      );

      if (response.ok) {
        try {
          rendererRef.current?.saveScrollPosition();
        } catch (e) {}
        fetchTasks();
      } else {
        const msg = await response.text();
        console.error('Error deleting task:', msg);
        alert('Failed to delete task.');
      }
    } catch (error) {
          console.error('Error deleting task:', error);
          alert('Error deleting task.');
    }      
  };

  const handleZoomIn = () => {
    setState(prev => ({
      ...prev,
      pixelsPerDay: Math.min(prev.pixelsPerDay + TimelineViewConstants.ZOOM_STEP, maxPixelsPerDay)
    }));
  };

  const handleZoomOut = () => {
    setState(prev => ({
      ...prev,
      pixelsPerDay: Math.max(prev.pixelsPerDay - TimelineViewConstants.ZOOM_STEP, minPixelsPerDay)
    }));
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      setState(prev => ({ ...prev, chartStartDate: new Date(dateValue) }));
    } else {
      setState(prev => ({ ...prev, chartStartDate: null }));
    }
  };


  // Parse owner sequence from props
  const ownerSequence = React.useMemo(() => {
    const sequence = props.ownerSequence;
    if (typeof sequence === 'string') {
      return sequence.split(',').map((s: string) => s.trim()).filter((s: string) => s);
    }
    return [];
  }, [props.ownerSequence]);

  // Check if configuration is missing
  const isConfigured = props.tripListId && props.destinationListId && props.titleColumn && props.ownerColumn && props.startDateColumn && props.endDateColumn;

  if (state.loading) {
    return (
      <div className={styles.timelineView}>
        <div className={styles.messageBox}>Loading tasks...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={styles.timelineView}>
        <div className={styles.errorBox}>{state.error}</div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className={styles.timelineView}>
        <div className={styles.messageBox}>
          <h3>Configuration Required</h3>
          <p>Please configure the web part properties:</p>
          <ul>
            {!props.tripListId && <li>• Select a SharePoint list</li>}
            {!props.destinationListId && <li>• Select a Destination list</li>}
            {!props.titleColumn && <li>• Select a Task Title column</li>}
            {!props.ownerColumn && <li>• Select an Owner column</li>}
            {!props.startDateColumn && <li>• Select a Start Date column</li>}
            {!props.endDateColumn && <li>• Select an End Date column</li>}
          </ul>
        </div>
      </div>
    );
  }

  if (state.tasks.length === 0) {
    return (
      <div className={styles.timelineView}>
        <div className={styles.messageBox}>
          <h3>No Tasks Found</h3>
          <p>The selected list does not contain any items.</p>
        </div>
      </div>
    );
  }
/*
            <!--
              <label htmlFor="startDateInput" style={{ fontWeight: 'bold', fontSize: '14px' }}>
                Timeline Start Date:
              </label> 
            -->

*/
  return (
    <div className={styles.timelineView}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <h2>{props.webpartTitle || 'Trip Planning (V 3.0)'}</h2>
        </div>
        <div className={styles.toolbarControls}>
          <div className={styles.startDateControl}>
            <input
              id="startDateInput"
              type="date"
              className={styles.dateInput}
              value={state.chartStartDate ? state.chartStartDate.toISOString().split('T')[0] : ''}
              onChange={handleStartDateChange}
            />
          </div>
          <div className={styles.rightControls}>
            <button
              onClick={() => handleAddTask(new Date(), '')}
              title="Add a new trip or right click on the timeline to add or modify a trip"
              className={styles.addTripButton}
            >
              <Icon iconName="Add" />
              Add a trip
            </button>
            <div className={styles.zoomControls}>
              <button
                onClick={handleZoomOut}
                disabled={state.pixelsPerDay <= minPixelsPerDay}
                title="Zoom Out"
              >
                <Icon iconName="ZoomOut" />
              </button>
              <button
                onClick={handleZoomIn}
                disabled={state.pixelsPerDay >= maxPixelsPerDay}
                title="Zoom In"
              >
                <Icon iconName="ZoomIn" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Timeline Renderer */}
      <TimelineRenderer
        ref={rendererRef}
        groupedTasks={state.groupedTasks}
        pixelsPerDay={state.pixelsPerDay}
        chartStartDate={state.chartStartDate}
        ownerSequence={ownerSequence}
        onAddTask={handleAddTask}
        onModifyTask={handleModifyTask}
        onDeleteTask={handleDeleteTask}
      />

      <Panel
        isOpen={state.isPanelOpen}
        onDismiss={onDismissPanel}
        type={PanelType.medium}
        headerText={state.editingTask?.id ? 'Edit a Trip' : 'Add a New Trip'}
        closeButtonAriaLabel="Close"
        isLightDismiss={true}
      >
        <TaskForm
          task={state.editingTask}
          onSave={handleSaveTask}
          onCancel={onDismissPanel}
          spHttpClient={props.spHttpClient}
          webUrl={props.webUrl}
          tripListId={props.tripListId as string}
          destinationListId={props.destinationListId}
          ownerColumn={props.ownerColumn as string}
          categoryColumn={props.categoryColumn as string}
        />
      </Panel>
      {ConfirmDialog}
    </div>
  );
};

export default TimelineView;
