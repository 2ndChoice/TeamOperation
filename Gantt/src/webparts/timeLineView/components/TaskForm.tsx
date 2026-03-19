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
  listId: string;
  ownerColumn: string;
  categoryColumn: string;
}

const stackTokens: IStackTokens = { childrenGap: 15 };

export const TaskForm: React.FC<ITaskFormProps> = (props) => {
  const [task, setTask] = useState<any>(props.task || {});
  const [destinationOptions, setDestinationOptions] = useState<IComboBoxOption[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<IComboBoxOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<IComboBoxOption[]>([]);

  useEffect(() => {
    setTask(props.task || {});
  }, [props.task]);

  useEffect(() => {
    const fetchDestinations = async () => {
      if (!props.spHttpClient || !props.webUrl) return;
      try {
        const response = await props.spHttpClient.get(
          `${props.webUrl}/_api/web/lists/GetByTitle('sg_CityCountry')/items?$select=Id,Title&$top=5000`,
          SPHttpClient.configurations.v1
        );
        if (response.ok) {
          const data = await response.json();
          const options: IComboBoxOption[] = data.value.map((item: any) => ({
            key: item.Id,
            text: item.Title
          }));
          setDestinationOptions(options);
        } else {
          console.error('Failed to fetch sg_CityCountry list');
        }
      } catch (error) {
        console.error('Error fetching destinations:', error);
      }
    };
    fetchDestinations();
  }, [props.spHttpClient, props.webUrl]);

  useEffect(() => {
    const fetchChoices = async () => {
      if (!props.spHttpClient || !props.webUrl || !props.listId) return;
      try {
        if (props.ownerColumn) {
          const ownerRes = await props.spHttpClient.get(
            `${props.webUrl}/_api/web/lists('${props.listId}')/fields/getByInternalNameOrTitle('${props.ownerColumn}')`,
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
            `${props.webUrl}/_api/web/lists('${props.listId}')/fields/getByInternalNameOrTitle('${props.categoryColumn}')`,
            SPHttpClient.configurations.v1
          );
          if (categoryRes.ok) {
            const categoryData = await categoryRes.json();
            if (categoryData.Choices) {
              setCategoryOptions(categoryData.Choices.map((choice: string) => ({ key: choice, text: choice })));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching choices:', error);
      }
    };
    fetchChoices();
  }, [props.spHttpClient, props.webUrl, props.listId, props.ownerColumn, props.categoryColumn]);

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

  return (
    <Stack tokens={stackTokens} styles={{ root: { padding: 20 } }}>
      <TextField label="Trip short description" value={task.name || ''} onChange={onTitleChange} required />
      <ComboBox
        label="Consultant"
        options={ownerOptions}
        text={task.owner || ''}
        allowFreeform={true}
        autoComplete="on"
        onChange={onOwnerChange}
      />
      <ComboBox
        label="Category"
        options={categoryOptions}
        text={task.category || ''}
        allowFreeform={true}
        autoComplete="on"
        onChange={onCategoryChange}
      />
      <ComboBox
        label="Destination"
        options={destinationOptions}
        text={task.destination || ''}
        allowFreeform={true}
        autoComplete="on"
        onChange={onDestinationChange}
      />
      <TextField label="TR Number" value={task.trNumber || ''} onChange={onTrNumberChange} />
      <TextField label="Cost" type="number" value={task.cost || ''} onChange={onCostChange} />
      <DatePicker label="Start Date" value={task.start} onSelectDate={onStartDateChange} />
      <DatePicker label="End Date" value={task.end} onSelectDate={onEndDateChange} />
      <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end">
        <PrimaryButton text="Save" onClick={onSave} disabled={!task.name} />
        <DefaultButton text="Cancel" onClick={props.onCancel} />
      </Stack>
    </Stack>
  );
};
