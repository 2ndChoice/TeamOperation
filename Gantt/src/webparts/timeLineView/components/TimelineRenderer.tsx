import * as React from 'react';
import styles from './TimeLineView.module.scss';
import { ITask } from './ITimeLineViewProps';
import { ContextualMenu, IContextualMenuItem } from '@fluentui/react/lib/ContextualMenu';

const TimelineConstants = {
  ROW_HEIGHT: 50,
  LEFT_COLUMN_WIDTH: 150,
  MIN_TASK_WIDTH: 30,
  MILLISECONDS_PER_DAY: 1000 * 60 * 60 * 24,
  WEEK_VIEW_THRESHOLD: 12,
  DAYS_IN_A_WEEK: 7,
  TASK_HEIGHT: 26,
  TASK_TOP_OFFSET: 12,
  TASK_WIDTH_REDUCTION: 8,
  TASK_BORDER_RADIUS: 3,
  TASK_FONT_SIZE: 11,
  TASK_PADDING_X: 4,
  TODAY_LINE_WIDTH: 2,
  HEADER_PADDING_TOP: 12,
  HEADER_PADDING_X: 8
};

interface ITimelineRendererProps {
  groupedTasks: { [owner: string]: ITask[] };
  pixelsPerDay: number;
  chartStartDate: Date | null;
  onTaskClick?: (task: ITask) => void;
  ownerSequence: string[];
  onAddTask?: (date: Date, owner: string) => void;
  onModifyTask?: (task: ITask) => void;
  onDeleteTask?: (task: ITask) => void;
}

const TimelineRenderer: React.FC<ITimelineRendererProps> = ({ groupedTasks, pixelsPerDay, chartStartDate, onTaskClick, ownerSequence, onAddTask, onModifyTask, onDeleteTask }) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const timelineRowsRef = React.useRef<HTMLDivElement>(null);
  const headerScrollRef = React.useRef<HTMLDivElement>(null);
  const [contextualMenuProps, setContextualMenuProps] = React.useState<{ items: IContextualMenuItem[], target: MouseEvent | Element } | undefined>(undefined);

  const theStartDate = chartStartDate ? new Date(chartStartDate.getTime()) : new Date(new Date().getFullYear(), 0, 1);

  // Sort owners based on predefined sequence
  const sortedOwners = React.useMemo(() => {
    const owners = Array.from(new Set([...Object.keys(groupedTasks), ...ownerSequence]));
    return owners.sort((a, b) => {
      const indexA = ownerSequence.indexOf(a);
      const indexB = ownerSequence.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      return a.localeCompare(b);
    });
  }, [groupedTasks, ownerSequence]);

  // Sync horizontal scroll between header and rows
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = (e.target as HTMLDivElement).scrollLeft;
    if (timelineRowsRef.current) {
      timelineRowsRef.current.scrollLeft = scrollLeft;
    }
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollLeft;
    }
  };

  // Color palette for owners
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#ee7a27ff', '#AED6F1'
  ];

  const getOwnerColor = (owner: string): string => {
    let hash = 0;
    for (let i = 0; i < owner.length; i++) {
      hash = owner.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Calculate date range across all tasks
  const getAllDates = () => {
    let minDate = new Date();
    let maxDate = new Date();
    let firstTask = true;

    (Object.keys(groupedTasks) as string[]).forEach((ownerKey: string) => {
      (groupedTasks[ownerKey] as ITask[]).forEach((task: ITask) => {
        if (firstTask) {
          minDate = new Date(task.start);
          maxDate = new Date(task.end);
          firstTask = false;
        } else {
          if (task.start < minDate) minDate = new Date(task.start);
          if (task.end > maxDate) maxDate = new Date(task.end);
        }
      });
    });

    // Add padding to date range
    minDate.setDate(minDate.getDate() - TimelineConstants.DAYS_IN_A_WEEK);
    maxDate.setDate(maxDate.getDate() + TimelineConstants.DAYS_IN_A_WEEK);

    return { minDate, maxDate };
  };


  const { minDate, maxDate } = getAllDates();

  const totalDays = Math.ceil((maxDate.getTime() - theStartDate.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY);

  // Determine zoom label based on pixelsPerDay
  // If pixelsPerDay >= 12, show week labels; otherwise show month labels
  const shouldShowWeekLabels = pixelsPerDay >= TimelineConstants.WEEK_VIEW_THRESHOLD;

  const timelineWidth = totalDays * pixelsPerDay;

  // Format date for headers
  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = ('0' + date.getDate()).slice(-2);
    return `${months[date.getMonth()]}.${day}.${date.getFullYear().toString().slice(-2)}`;
  }
  

  // Generate header dates
  // - If pixelsPerDay >= 12: show week start dates (Monday)
  // - If pixelsPerDay < 12: show first day of each month
  const getHeaderDates = () => {
    const headerDates: Date[] = [];
    // Create a NEW Date object, don't reference the prop directly
    let currentDate = new Date(theStartDate);

    // print out the start date: 
    // headerDates.push(new Date(theStartDate));

    if (shouldShowWeekLabels) {
      // Week: align to Monday of the week containing startDate
      const day = currentDate.getDay(); // 0 (Sun) - 6 (Sat)
      const diffToSunday = day; // 0 if Sunday, 6 if Sat
      currentDate.setDate(currentDate.getDate() - diffToSunday);
      if (currentDate < theStartDate) {
        currentDate.setDate(currentDate.getDate() + 7);
      }

      while (currentDate <= maxDate) {
        headerDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 7);
      }
      // draw one extra week at the end for better UX
      headerDates.push(new Date(currentDate));
    } else {
      // For month zoom: show first day of every month
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      while (currentDate <= maxDate) {
        headerDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      // draw one extra month at the end for better UX
      headerDates.push(new Date(currentDate));
    }

    return headerDates;
  };

  const headerDates = getHeaderDates();

  const getGridDates = () => {
    const GridWeekDates: Date[] = [];
    // Create a NEW Date object, don't reference the prop directly
    let currentDate = new Date(theStartDate);

    // Week: align to Monday of the week containing startDate
    const day = currentDate.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToSunday = day; // 0 if Sunday, 6 if Sat
    currentDate.setDate(currentDate.getDate() - diffToSunday);
    if (currentDate < theStartDate) {
        currentDate.setDate(currentDate.getDate() + 7);
    }

    while (currentDate <= maxDate) {
        GridWeekDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 7);
    }

    return GridWeekDates;
  };

  const gridDates = getGridDates();

  // Calculate position and width for a task bar
  const getTaskPosition = (task: ITask) => {
    const startDays = Math.ceil((task.start.getTime() - theStartDate.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY);
    const endDays = Math.ceil((task.end.getTime() - theStartDate.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY);
    const right = Math.max(Math.ceil((task.end.getTime() - task.start.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY) + 1, 1); // At least 1 day
    const width = (endDays + 1 - startDays) * pixelsPerDay;

    return {
      left: startDays * pixelsPerDay,
      width: Math.max(width, TimelineConstants.MIN_TASK_WIDTH) // Minimum width of 30px
    };
  };

  const onHideContextualMenu = React.useCallback(() => setContextualMenuProps(undefined), []);

  const handleTaskContextMenu = (e: React.MouseEvent, task: ITask) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent the container's context menu from firing

    setContextualMenuProps({
      items: [
        {
          key: 'modify',
          text: 'Modify Task',
          iconProps: { iconName: 'Edit' },
          onClick: (ev, item) => {
            console.log('Modify Task clicked for:', task);
            if (onModifyTask) {
              onModifyTask(task);
            } else {
              console.warn('onModifyTask prop is undefined');
            }
          }
        },
        {
          key: 'delete',
          text: 'Delete Task',
          iconProps: { iconName: 'Delete' },
          onClick: () => {
            if (onDeleteTask) onDeleteTask(task);
          }
        }
      ],
      target: e.nativeEvent
    });
  };

  const handleContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Calculate the date corresponding to the click position
    const container = e.currentTarget as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    
    // X position relative to the start of the timeline content
    const x = e.clientX - rect.left + scrollLeft;
    const daysToAdd = Math.floor(x / pixelsPerDay);
    const clickedDate = new Date(theStartDate.getTime() + daysToAdd * TimelineConstants.MILLISECONDS_PER_DAY);

    // Y position to determine owner
    const y = e.clientY - rect.top;
    const ownerIndex = Math.floor(y / TimelineConstants.ROW_HEIGHT);
    const owner = sortedOwners[ownerIndex];

    setContextualMenuProps({
      items: [
        {
          key: 'add',
          text: 'Add New Task',
          iconProps: { iconName: 'Add' },
          onClick: () => {
            if (onAddTask) onAddTask(clickedDate, owner);
          }
        }
      ],
      target: e.nativeEvent
    });
  };

  return (
    <div className={styles.customTimeline}>
        {/* Header with date labels - Fixed position */}
        <div className={styles.timelineHeader}>
            <div style={{ width: `${TimelineConstants.LEFT_COLUMN_WIDTH}px`, flex: `0 0 ${TimelineConstants.LEFT_COLUMN_WIDTH}px`, borderRight: '1px solid #0078d4' }} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <div ref={headerScrollRef} style={{ overflowX: 'hidden' }}>
                    <div style={{ width: `${timelineWidth}px`, display: 'flex', flex: '0 0 auto', position: 'relative', height: `${TimelineConstants.ROW_HEIGHT}px` }}>
                    {headerDates.map((date: Date, idx: number) => {  
                        const lastDate = idx === 0 ? theStartDate : headerDates[idx - 1];              
                        const days = Math.ceil((date.getTime() - theStartDate.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY);
                        const width = Math.ceil((date.getTime() - lastDate.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY) * pixelsPerDay;
                        const left = days * pixelsPerDay;
                        return (
                        <div
                            key={idx}
                            style={{
                            position: 'absolute',
                            left: `${left - 20}px`,
                            top: 0,                        
                            width: `${width}px`,
                            height: `${TimelineConstants.ROW_HEIGHT}px`,
                            padding: `${TimelineConstants.HEADER_PADDING_TOP}px ${TimelineConstants.HEADER_PADDING_X}px 0px 0px`,
                            textAlign: 'left',
                            boxSizing: 'border-box'
                            }}>
                                {formatDate(date)}
                                <div
                                    key={`sub-${idx}`}
                                    style={{
                                    position: 'absolute',
                                    left: '20px',
                                    top: '30px',                        
                                    width: '1px',
                                    height: `${TimelineConstants.ROW_HEIGHT - 30}px`,
                                    borderLeft: '1px solid #ddd',
                                    boxSizing: 'border-box'
                                    }}>
                                </div>
                        </div>
                        );
                    })}
                    </div>
                </div>
            </div>
        </div>

        {/* Content wrapper with fixed left column and scrollable timeline */}
        <div className={styles.timelineRowsWrapper}>
            {/* Fixed owner name column on the left */}
            <div className={styles.fixedNameColumn}>
            {sortedOwners.map((owner: string) => {
                return (
                    <div key={`name-${owner}`} className={styles.ownerNameRow}>
                        <span className={styles.ownerName}>{owner}</span>
                    </div>
                );
            })}
            </div>

        {/* Scrollable timeline content on the right */}
        <div 
          ref={scrollContainerRef}
          className={styles.timelineScrollContainer}
          onScroll={handleScroll}
          onContextMenu={handleContainerContextMenu}
        >
          {/* Timeline Rows - All scroll together (with vertical grid lines) */}
          <div ref={timelineRowsRef} className={styles.timelineRows} style={{ position: 'relative' }}>
            {/* Vertical grid lines spanning all rows */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: `${sortedOwners.length * TimelineConstants.ROW_HEIGHT}px`,
                width: `${timelineWidth}px`,
                pointerEvents: 'none',
                zIndex: 1
              }}
            >
              {gridDates.map((date: Date, idx: number) => {
                const days = Math.ceil((date.getTime() - theStartDate.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY);
                const left = days * pixelsPerDay;
                return (
                  <div
                    key={`vWeekline-${idx}`}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: 0,
                      bottom: 0,
                      width: '0px',
                      borderLeft: '1px dotted #e6e6e6'
                    }}
                  />
                );
              })}
              {!shouldShowWeekLabels && headerDates.map((date: Date, idx: number) => {
                //const lastDate = idx === 0 ? startDate : headerDates[idx - 1];
                const days = Math.ceil((date.getTime() - theStartDate.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY);
                const left = days * pixelsPerDay;
                return (
                  <div
                    key={`vline-${idx}`}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: 0,
                      bottom: 0,
                      width: '1px',
                      background: '#d5d5d5'
                    }}
                  />
                );
              })}
              { // draw today's date line
                (() => {
                  const today = new Date();
                    if (today >= theStartDate && today <= maxDate) {
                        const days = Math.ceil((today.getTime() - theStartDate.getTime()) / TimelineConstants.MILLISECONDS_PER_DAY);
                        const left = days * pixelsPerDay;
                        return (
                          <div
                            key="today-line"
                            style={{
                              position: 'absolute',
                              left: `${left}px`,
                              top: 0,
                              bottom: 0,
                              width: `${TimelineConstants.TODAY_LINE_WIDTH}px`,
                              background: 'green'
                            }}
                          />
                        );
                    }
                })()}
            </div>

            {/* Row group rendered above grid lines */}
            <div style={{ position: 'relative', zIndex: 2 }}>
              {sortedOwners.map((owner: string) => {
                const tasks = groupedTasks[owner] || [];
                return (
                  <div key={owner} className={styles.ownerSection} data-level="owner">
                    {/* Owner Row with all their task bars */}
                    <div className={styles.timelineRow} data-level="owner-row">
                      <div style={{ width: `${timelineWidth}px`, height: `${TimelineConstants.ROW_HEIGHT}px`, position: 'relative' }} data-level="owner-rows-tasks">
                        {/* All task bars for this owner in the same row */}
                        {tasks.map((task: ITask, taskIdx: number) => {
                          const { left, width: barWidth } = getTaskPosition(task);
                          return (
                            <div
                              key={task.id}
                              className={styles.taskBar}
                              style={{
                                position: 'absolute',
                                left: `${left}px`,
                                width: `${barWidth - TimelineConstants.TASK_WIDTH_REDUCTION}px`,
                                top: `${TimelineConstants.TASK_TOP_OFFSET}px`,
                                height: `${TimelineConstants.TASK_HEIGHT}px`,
                                backgroundColor: getOwnerColor(owner),
                                borderRadius: `${TimelineConstants.TASK_BORDER_RADIUS}px`,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'left',
                                fontSize: `${TimelineConstants.TASK_FONT_SIZE}px`,
                                color: '#fff',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                paddingLeft: `${TimelineConstants.TASK_PADDING_X}px`,
                                paddingRight: `${TimelineConstants.TASK_PADDING_X}px`,
                                zIndex: 3
                              }}
                              onMouseEnter={(e) => {
                                (e.target as HTMLElement).style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                                (e.target as HTMLElement).style.opacity = '0.85';
                              }}
                              onMouseLeave={(e) => {
                                (e.target as HTMLElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                (e.target as HTMLElement).style.opacity = '1';
                              }}
                              onContextMenu={(e) => handleTaskContextMenu(e, task)}
                              onClick={() => onTaskClick?.(task)}
                              title={`${task.name}: ${task.start.toLocaleDateString()} - ${task.end.toLocaleDateString()}`}>
                              {task.name}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {contextualMenuProps && (
        <ContextualMenu
          items={contextualMenuProps.items}
          target={contextualMenuProps.target}
          onDismiss={onHideContextualMenu}
        />
      )}
    </div>
  );
};

export default TimelineRenderer;
