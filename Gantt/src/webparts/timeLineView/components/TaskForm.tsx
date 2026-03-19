import * as React from 'react';
import { useState, useEffect } from 'react';
import { ITask } from './ITimeLineViewProps';
import { TextField } from '@fluentui/react/lib/TextField';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Stack, IStackTokens } from '@fluentui/react/lib/Stack';
import { ComboBox, IComboBoxOption, IComboBox } from '@fluentui/react/lib/ComboBox';
import { SPHttpClient } from '@microsoft/sp-http';

export interface ITaskFormProps {
  task: Partial<ITask> | null;
  onSave: (task: Partial<ITask>) => void;
  onCancel: () => void;
  spHttpClient: SPHttpClient;
  webUrl: string;
  tripListId: string;
  destinationListId?: string;
  ownerColumn: string;
  categoryColumn: string;
}

const stackTokens: IStackTokens = { childrenGap: 15 };

export const TaskForm: React.FC<ITaskFormProps> = (props) => {
  const [task, setTask] = useState<any>(() => {
    const initialTask = { ...(props.task || {}) };
    // If it's a new record (no ID) and has a start date but no end date, default to start + 5 days
    if (!initialTask.id && initialTask.start && !initialTask.end) {
      const endDate = new Date(initialTask.start.getTime());
      endDate.setDate(endDate.getDate() + 5);
      initialTask.end = endDate;
    }
    return initialTask;
  });
  const [allDestinations, setAllDestinations] = useState<IComboBoxOption[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<IComboBoxOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<IComboBoxOption[]>([]);

  useEffect(() => {
    const updatedTask = { ...(props.task || {}) };
    if (!updatedTask.id && updatedTask.start && !updatedTask.end) {
      const endDate = new Date(updatedTask.start.getTime());
      endDate.setDate(endDate.getDate() + 5);
      updatedTask.end = endDate;
    }
    setTask(updatedTask);
  }, [props.task]);

  useEffect(() => {
    const fetchDestinations = async () => {
      if (!props.spHttpClient || !props.webUrl || !props.destinationListId) return;
      try {
        const response = await props.spHttpClient.get(
          `${props.webUrl}/_api/web/lists('${props.destinationListId}')/items?$select=Id,Title&$top=5000`,
          SPHttpClient.configurations.v1
        );
        if (response.ok) {
          const data = await response.json();
          const options: IComboBoxOption[] = data.value.map((item: any) => ({
            key: item.Id,
            text: item.Title
          }));
          setAllDestinations(options);
        } else {
          console.error('Failed to fetch location (city/country) list');
        }
      } catch (error) {
        console.error('Error fetching destinations:', error);
      }
    };
    fetchDestinations();
  }, [props.spHttpClient, props.webUrl, props.destinationListId]);

  useEffect(() => {
    const fetchChoices = async () => {
      if (!props.spHttpClient || !props.webUrl || !props.tripListId) return;
      try {
        if (props.ownerColumn) {
          const ownerRes = await props.spHttpClient.get(
            `${props.webUrl}/_api/web/lists('${props.tripListId}')/fields/getByInternalNameOrTitle('${props.ownerColumn}')`,
            SPHttpClient.configurations.v1
          );
          if (ownerRes.ok) {
            const ownerData = await ownerRes.json();
            if (ownerData.Choices) {
              setOwnerOptions(ownerData.Choices.map((choice: string) => ({ key: choice, text: choice })));
            }
          }
        }

        if (props.categoryColumn) {
          const categoryRes = await props.spHttpClient.get(
            `${props.webUrl}/_api/web/lists('${props.tripListId}')/fields/getByInternalNameOrTitle('${props.categoryColumn}')`,
            SPHttpClient.configurations.v1
          );
          if (categoryRes.ok) {
            const categoryData = await categoryRes.json();
            if (categoryData.Choices) {
              const choices = categoryData.Choices.map((choice: string) => ({ key: choice, text: choice }));
              setCategoryOptions(choices);
              setTask((prev: any) => {
                if (!prev.category && choices.length > 0) {
                  return { ...prev, category: choices[0].text };
                }
                return prev;
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching choices:', error);
      }
    };
    fetchChoices();
  }, [props.spHttpClient, props.webUrl, props.tripListId, props.ownerColumn, props.categoryColumn]);

  const onTitleChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    setTask({ ...task, name: newValue || '' });
  };

  const onOwnerChange = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption, index?: number, value?: string) => {
    setTask({ ...task, owner: option ? option.text : value });
  };

  const onCategoryChange = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption, index?: number, value?: string) => {
    setTask({ ...task, category: option ? option.text : value });
  };

  const onDestinationChange = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption, index?: number, value?: string) => {
    setTask({ ...task, destination: option ? option.text : value, destinationId: option ? option.key : undefined });
  };

  // Handle raw text input to update the state and safely capture IDs on exact typing matches
  const onDestinationInputValueChange = (text: string) => {
    setTask((prev: any) => {
      const exactMatch = allDestinations.find(o => o.text.toLowerCase() === text.toLowerCase());
      return { ...prev, destination: text, destinationId: exactMatch ? exactMatch.key : undefined };
    });
  };

  const onTrNumberChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    setTask({ ...task, trNumber: newValue || '' });
  };

  const onCostChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    setTask({ ...task, cost: newValue || '' });
  };

  const onStartDateChange = (date: Date | null | undefined) => {
    setTask({ ...task, start: date || new Date() });
  };

  const onEndDateChange = (date: Date | null | undefined) => {
    setTask({ ...task, end: date || new Date() });
  };

  const onSave = () => {
    props.onSave(task);
  };

  // Validate that all required fields have a value (and aren't just empty spaces)
  const isFormValid = !!(
    task.name?.trim() &&
    task.owner?.trim() &&
    task.category?.trim() &&
    task.destination?.trim() &&
    task.start &&
    task.end
  );

  // Dynamically filter options based on the typed destination text and limit to 10 results
  const destinationOptions = React.useMemo(() => {
    const text = task.destination || '';
    if (!text) {
      return allDestinations.slice(0, 10);
    }
    const filtered = allDestinations.filter(o => o.text.toLowerCase().includes(text.toLowerCase()));
    return filtered.slice(0, 10);
  }, [allDestinations, task.destination]);

  return (
    <Stack tokens={stackTokens} styles={{ root: { padding: 20 } }}>
      <TextField label="Trip short description" value={task.name || ''} onChange={onTitleChange} required />
      <ComboBox
        label="Consultant"
        options={ownerOptions}
        text={task.owner || ''}
        allowFreeform={true}
        autoComplete="on"
        required={true}
        onChange={onOwnerChange}
      />
      <DatePicker label="Start Date" value={task.start} onSelectDate={onStartDateChange} isRequired={true} />
      <DatePicker label="End Date" value={task.end} onSelectDate={onEndDateChange} isRequired={true} />
      <ComboBox
        label="Trip type"
        options={categoryOptions}
        text={task.category || ''}
        allowFreeform={true}
        autoComplete="on"
        required={true}
        onChange={onCategoryChange}
      />
      <ComboBox
        label="Destination"
        options={destinationOptions}
        text={task.destination || ''}
        allowFreeform={true}
        autoComplete="on"
        required={true}
        onChange={onDestinationChange}
        onInputValueChange={onDestinationInputValueChange}
      />
      <TextField label="TR Number" value={task.trNumber || ''} onChange={onTrNumberChange} />
      <TextField label="Cost" type="number" value={task.cost || ''} onChange={onCostChange} />
      <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end">
        <PrimaryButton 
          text="Save" 
          onClick={onSave} 
          disabled={!isFormValid} 
          styles={{
            root: { backgroundColor: 'lightblue', borderColor: '#8a8886', color: 'black' },
            rootHovered: { backgroundColor: '#87ceeb', borderColor: '#8a8886', color: 'black' },
            rootPressed: { backgroundColor: '#00bfff', borderColor: '#8a8886', color: 'black' }
          }}
        />
        <DefaultButton text="Cancel" onClick={props.onCancel} />
      </Stack>
    </Stack>
  );
};
