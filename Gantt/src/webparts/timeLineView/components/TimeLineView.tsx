import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './TimeLineView.module.scss';
import { ITask, ITimelineViewProps } from './ITimeLineViewProps';
import TimelineRenderer from './TimelineRenderer';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { Icon } from '@fluentui/react/lib/Icon';
import { Panel, PanelType } from '@fluentui/react/lib/Panel';

export interface ITimelineViewState {
  tasks: ITask[];
  groupedTasks: { [owner: string]: ITask[] };
  loading: boolean;
  pixelsPerDay: number;
  error: string | null;
  chartStartDate: Date | null;
  isPanelOpen: boolean;
  panelUrl: string;
} 

const TimelineViewConstants = {
  DEFAULT_PIXELS_PER_DAY: 20,
  MIN_PIXELS_PER_DAY: 5,
  MAX_PIXELS_PER_DAY: 30,
  ZOOM_STEP: 1,
  DAYS_IN_A_WEEK: 7,
  API_ITEM_LIMIT: 5000,
  MILLISECONDS_PER_DAY: 1000 * 60 * 60 * 24,
  BUTTON_SIZE: 28
};

const TimelineView: React.FC<ITimelineViewProps> = (props) => {
  const iframeInitialLoad = useRef<boolean>(true);
  const [state, setState] = useState<ITimelineViewState>({
    tasks: [],
    groupedTasks: {},
    loading: true,
    pixelsPerDay: TimelineViewConstants.DEFAULT_PIXELS_PER_DAY,
    error: null,
    chartStartDate: new Date(new Date().getFullYear(), 0, 1),
    isPanelOpen: false,
    panelUrl: ''
    });

  // Fetch tasks from SharePoint
  const fetchTasks = useCallback(async () => {
    console.log('=== fetchTasks called ===');
    console.log('Props:', {
      listId: props.listId,
      listURL: props.listURL,
      titleColumn: props.titleColumn,
      ownerColumn: props.ownerColumn,
      startDateColumn: props.startDateColumn,
      endDateColumn: props.endDateColumn
    });

    if (!props.listId && !props.listURL) {
      console.warn('No list selected');
      setState(prev => ({ ...prev, loading: false, error: 'Please select a list and specify the list URL' }));
      return;
    }

    const titleCol = props.titleColumn;
    const ownerCol = props.ownerColumn;
    const startDateCol = props.startDateColumn;
    const endDateCol = props.endDateColumn;

    if (!titleCol || !startDateCol || !endDateCol) {
      console.error('Required columns not configured');
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Please configure all required columns (Title, Start Date, End Date)'
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const listSelector = props.listId 
        ? `lists('${props.listId}')` 
        : `lists/getbytitle('${encodeURIComponent(props.listURL || '')}')`;

      const selectFields = ['ID', titleCol];
      if (ownerCol) {
        selectFields.push(ownerCol);
      }
      selectFields.push(startDateCol, endDateCol);

      const selectQuery = selectFields.join(',');
      
      // Build filter for start date if specified
      let filterQuery = '';
      if (state.chartStartDate) {
        const filterDate = state.chartStartDate.toISOString();
        filterQuery = `&$filter=${startDateCol} ge datetime'${filterDate}'`;
      }
      
      const apiUrl = `${props.webUrl}/_api/web/${listSelector}/items?$select=${selectQuery}${filterQuery}&$orderby=${startDateCol} asc&$top=${TimelineViewConstants.API_ITEM_LIMIT}`;

      console.log('Fetching from URL:', apiUrl);

      const response: SPHttpClientResponse = await props.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        throw new Error(`Failed to fetch: ${response.status}`);
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
          start: startDate,
          end: endDate,
          progress: 0,
          custom_class: ''
        };
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
  }, [props.listId, props.listURL, props.titleColumn, props.ownerColumn, props.startDateColumn, props.endDateColumn, props.webUrl, props.spHttpClient, state.chartStartDate]);

  const updateTaskDate = async (taskId: string, start: Date, end: Date) => {
    console.log('Updating task:', taskId, start, end);
  };

  const onDismissPanel = React.useCallback(() => {
    console.log('onDismissPanel called');
    setState(prev => ({ ...prev, isPanelOpen: false, panelUrl: '' }));
    fetchTasks();
  }, [fetchTasks]);


  // Fetch tasks on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Refresh tasks when window gets focus (e.g. returning from the Power App form)
  useEffect(() => {
    const handleFocus = () => {
      fetchTasks();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchTasks]);

  const handleAddTask = (date: Date, owner: string) => {
    if (!props.listURL) return;

    iframeInitialLoad.current = true; // Reset on open

    // Format date as YYYY-MM-DD for the URL parameter
    const dateParam = date.toISOString().split('T')[0];

    let url = `${props.listURL}?Mode=new&${props.startDateColumn}=${dateParam}&env=Embedded&hideNavbar=true&Source=${encodeURIComponent(window.location.href)}`;

    if (props.ownerColumn && owner) {
      url += `&${props.ownerColumn}=${encodeURIComponent(owner)}`;
    }

    console.log('Opening New Form URL:', url);

    setState(prev => ({ ...prev, isPanelOpen: true, panelUrl: url }));
  };

  const handleModifyTask = (task: ITask) => {

    if (!props.listURL) return;

    iframeInitialLoad.current = true; // Reset on open

    let url = `${props.listURL}?Mode=edit&ID=${task.id}&env=Embedded&hideNavbar=true&Source=${encodeURIComponent(window.location.href)}`;

    setState(prev => ({ ...prev, isPanelOpen: true, panelUrl: url }));
  };

  const handleDeleteTask = async (task: ITask) => {
    if (!confirm(`Are you sure you want to delete "${task.name}"?`)) return;

    try {
      const listSelector = props.listId 
        ? `lists('${props.listId}')` 
        : `lists/getbytitle('${encodeURIComponent(props.listURL || '')}')`;
        
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
      pixelsPerDay: Math.min(prev.pixelsPerDay + TimelineViewConstants.ZOOM_STEP, TimelineViewConstants.MAX_PIXELS_PER_DAY)
    }));
  };

  const handleZoomOut = () => {
    setState(prev => ({
      ...prev,
      pixelsPerDay: Math.max(prev.pixelsPerDay - TimelineViewConstants.ZOOM_STEP, TimelineViewConstants.MIN_PIXELS_PER_DAY)
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

  const handleTaskClick = (task: ITask) => {
    console.log('Task clicked:', task);
    alert(`Task: ${task.name}\nOwner: ${task.owner}\nStart: ${task.start.toLocaleDateString()}\nEnd: ${task.end.toLocaleDateString()}`);
  };


  const onIframeError = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    console.error('iframe loading error:', e);
  };

  const onIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    // The first time `onLoad` fires, we assume it's the initial load of the form.
    // If it fires again, we assume the form was submitted or cancelled, and the
    // app navigated, triggering a reload. This is a fragile assumption but can
    // work if the Power App is configured to navigate on completion.
    // The `postMessage` listener is still the most robust solution.
    console.log('Iframe loaded.');

    if (iframeInitialLoad.current) {
        console.log('Initial load of form. Ignoring.');
        iframeInitialLoad.current = false; // It has now loaded once
        return;
    } else {
        console.log('Subsequent load of form detected. Closing panel.');
        onDismissPanel();
        return;
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
  const isConfigured = (props.listId || props.listURL) && props.titleColumn && props.startDateColumn && props.endDateColumn;

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
            {!props.listId && !props.listURL && <li>• Select a SharePoint list and URL</li>}
            {!props.titleColumn && <li>• Select a Task Title column</li>}
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
          <h2>Trip Planning (V 2.0)</h2>
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
              Add a Trip
            </button>
            <div className={styles.zoomControls}>
              <button
                onClick={handleZoomOut}
                disabled={state.pixelsPerDay <= TimelineViewConstants.MIN_PIXELS_PER_DAY}
                title="Zoom Out"
              >
                <Icon iconName="ZoomOut" />
              </button>
              <button
                onClick={handleZoomIn}
                disabled={state.pixelsPerDay >= TimelineViewConstants.MAX_PIXELS_PER_DAY}
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
        groupedTasks={state.groupedTasks}
        pixelsPerDay={state.pixelsPerDay}
        chartStartDate={state.chartStartDate}
        onTaskClick={handleTaskClick}
        ownerSequence={ownerSequence}
        onAddTask={handleAddTask}
        onModifyTask={handleModifyTask}
        onDeleteTask={handleDeleteTask}
      />

      <Panel
        isOpen={state.isPanelOpen}
        onDismiss={onDismissPanel}
        type={PanelType.medium}
        headerText="Trip Details"
        closeButtonAriaLabel="Close"
        isLightDismiss={true}
      >
        <div style={{ width: '100%', height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
          <iframe 
            src={state.panelUrl} 
            onLoad={onIframeLoad}
            onError={onIframeError}
            width="100%" 
            height="100%" 
            style={{ border: 'none' }} 
            title="Task Form" 
          />          
        </div>
      </Panel>
    </div>
  );
};

export default TimelineView;
