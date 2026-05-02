import {
  CheckCircleOutlined,
  SyncOutlined,
  DownOutlined,
  RightOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@/shared/antd-imports';
import { useState } from 'react';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Flex from 'antd/es/flex';
import Card from 'antd/es/card';
import Collapse from 'antd/es/collapse';
import ConfigProvider from 'antd/es/config-provider';
import Table, { TableProps } from 'antd/es/table';
import Tooltip from 'antd/es/tooltip';
import Typography from 'antd/es/typography';
import Button from 'antd/es/button';
import Alert from 'antd/es/alert';

import EmptyListPlaceholder from '@components/EmptyListPlaceholder';
import { IMyTask } from '@/types/home/my-tasks.types';
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import {
  useGetPersonalTasksQuery,
  useMarkPersonalTaskAsDoneMutation,
  useUpdatePersonalTaskMutation,
  useDeletePersonalTaskMutation,
} from '@/api/home-page/home-page.api.service';
import { useCreatePersonalTaskMutation } from '@/api/home-page/home-page.api.service';

const TodoList = () => {
  const [isAlertShowing, setIsAlertShowing] = useState(false);
  const [activeView, setActiveView] = useState<'todo' | 'done'>('todo');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');
  const [form] = Form.useForm();
  const { t } = useTranslation('home');

  const [createPersonalTask] = useCreatePersonalTaskMutation();
  const [markPersonalTaskAsDone] = useMarkPersonalTaskAsDoneMutation();
  const [updatePersonalTask] = useUpdatePersonalTaskMutation();
  const [deletePersonalTask] = useDeletePersonalTaskMutation();
  const { data, isFetching, refetch } = useGetPersonalTasksQuery();
  const tasks = data?.body || [];
  const todoTasks = tasks.filter(task => !Boolean(task.done ?? task.is_completed));
  const doneTasks = tasks.filter(task => Boolean(task.done ?? task.is_completed));
  const displayedTasks = activeView === 'todo' ? todoTasks : doneTasks;

  // function to handle todo submit
  const handleTodoSubmit = async (values: any) => {
    if (!values.name || values.name.trim() === '') return;
    const newTodo: IMyTask = {
      name: values.name,
      done: false,
      is_task: false,
      color_code: '#000',
    };

    const res = await createPersonalTask(newTodo);
    if (res.data) {
      refetch();
    }

    setIsAlertShowing(false);
    form.resetFields();
  };

  const handleCompleteTodo = async (id: string | undefined) => {
    if (!id) return;
    const res = await markPersonalTaskAsDone(id);
    if (res.data) {
      refetch();
    }
  };

  const handleDeleteTask = async (id: string | undefined) => {
    if (!id) return;
    const res = await deletePersonalTask(id);
    if ('data' in res && res.data?.done) {
      refetch();
    }
  };

  const handleStartEditTask = (task: IMyTask) => {
    setEditingTaskId(task.id || null);
    setEditingTaskName(task.name || '');
  };

  const handleSaveEditTask = async () => {
    if (!editingTaskId || !editingTaskName.trim()) {
      setEditingTaskId(null);
      setEditingTaskName('');
      return;
    }
    const res = await updatePersonalTask({ id: editingTaskId, name: editingTaskName.trim() });
    if ('data' in res && res.data?.done) {
      refetch();
    }
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  // table columns
  const todoColumns: TableProps<IMyTask>['columns'] = [
    {
      key: 'markDoneBtn',
      width: 40,
      render: (record: IMyTask) => (
        <ConfigProvider wave={{ disabled: true }}>
          <Tooltip title={t('home:todoList.markAsDone')}>
            <Button
              type="text"
              className="borderless-icon-btn"
              style={{ backgroundColor: colors.transparent }}
              shape="circle"
              icon={<CheckCircleOutlined style={{ color: colors.lightGray }} />}
              onClick={() => handleCompleteTodo(record.id)}
            />
          </Tooltip>
        </ConfigProvider>
      ),
    },
    {
      key: 'name',
      render: (record: IMyTask) => (
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          {editingTaskId === record.id ? (
            <Input
              size="small"
              value={editingTaskName}
              onChange={e => setEditingTaskName(e.target.value)}
              onPressEnter={handleSaveEditTask}
              onBlur={handleSaveEditTask}
              autoFocus
            />
          ) : (
            <Typography.Paragraph
              style={{ margin: 0, paddingInlineEnd: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              <Tooltip title={record.name}>{record.name}</Tooltip>
            </Typography.Paragraph>
          )}

          <Flex gap={4} className="todo-row-actions">
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleStartEditTask(record)}
              />
            </Tooltip>
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteTask(record.id)}
              />
            </Tooltip>
          </Flex>
        </Flex>
      ),
    },
  ];
  const doneColumns: TableProps<IMyTask>['columns'] = [
    {
      key: 'doneIcon',
      width: 32,
      render: () => <CheckCircleOutlined style={{ color: colors.limeGreen }} />,
    },
    {
      key: 'name',
      render: (record: IMyTask) => (
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Typography.Paragraph
            style={{
              margin: 0,
              paddingInlineEnd: 6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: colors.lightGray,
              textDecoration: 'line-through',
            }}
          >
            <Tooltip title={record.name}>{record.name}</Tooltip>
          </Typography.Paragraph>
          <Flex gap={4} className="todo-row-actions">
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteTask(record.id)}
              />
            </Tooltip>
          </Flex>
        </Flex>
      ),
    },
  ];

  return (
    <Card style={{ width: '100%' }} styles={{ body: { padding: 0 } }}>
      <style>{`
        .todo-collapse .ant-collapse-header {
          display: flex !important;
          align-items: center !important;
          padding: 12px 16px !important;
        }
        .todo-collapse .ant-collapse-expand-icon {
          margin-right: 8px !important;
          display: flex !important;
          align-items: center !important;
        }
        .todo-table-row .todo-row-actions {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .todo-table-row:hover .todo-row-actions {
          opacity: 1;
        }
      `}</style>
      <Collapse
        defaultActiveKey={[]}
        ghost
        size="small"
        className="todo-collapse"
        expandIcon={({ isActive }) => 
          isActive ? <DownOutlined /> : <RightOutlined />
        }
        items={[
          {
            key: '1',
            label: (
              <Flex style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {t('home:todoList.title')} ({todoTasks.length})
                </Typography.Title>
                <Flex align="center" gap={8}>
                  <Button
                    size="small"
                    type={activeView === 'done' ? 'primary' : 'default'}
                    onClick={e => {
                      e.stopPropagation();
                      setActiveView(activeView === 'todo' ? 'done' : 'todo');
                    }}
                  >
                    {activeView === 'todo'
                      ? `Marked as done (${doneTasks.length})`
                      : `Back to To do (${todoTasks.length})`}
                  </Button>
                  <Tooltip title={t('home:todoList.refreshTasks')}>
                    <Button 
                      shape="circle" 
                      icon={<SyncOutlined spin={isFetching} />} 
                      onClick={(e) => {
                        e.stopPropagation();
                        refetch();
                      }} 
                    />
                  </Tooltip>
                </Flex>
              </Flex>
            ),
            children: (
              <div style={{ padding: '0 16px 16px 16px' }}>
                {activeView === 'todo' && (
                  <Form form={form} onFinish={handleTodoSubmit}>
                    <Form.Item name="name">
                      <Flex vertical>
                        <Input.TextArea
                          placeholder={t('home:todoList.addTask')}
                          autoSize={{ minRows: 1, maxRows: 4 }}
                          maxLength={20000}
                          onPressEnter={e => {
                            if (!e.shiftKey) {
                              e.preventDefault();
                              form.submit();
                            }
                          }}
                          onChange={e => {
                            const inputValue = e.currentTarget.value;

                            if (inputValue.length >= 1) setIsAlertShowing(true);
                            else if (inputValue === '') setIsAlertShowing(false);
                          }}
                        />
                        {isAlertShowing && (
                          <Alert
                            message={
                              <Typography.Text style={{ fontSize: 11 }}>
                                {t('home:todoList.pressEnter')} <strong>Enter</strong>{' '}
                                {t('home:todoList.toCreate')}
                              </Typography.Text>
                            }
                            type="info"
                            style={{
                              width: 'fit-content',
                              borderRadius: 2,
                              padding: '0 6px',
                            }}
                          />
                        )}
                      </Flex>
                    </Form.Item>
                  </Form>
                )}

                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  {tasks.length === 0 ? (
                    <EmptyListPlaceholder
                      imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
                      text={t('home:todoList.noTasks')}
                    />
                  ) : (
                    <Table
                      className="custom-two-colors-row-table"
                      rowClassName={() => 'todo-table-row'}
                      rowKey={record => record.id || ''}
                      dataSource={displayedTasks}
                      columns={activeView === 'todo' ? todoColumns : doneColumns}
                      showHeader={false}
                      pagination={false}
                      size="small"
                      loading={isFetching}
                      locale={{
                        emptyText:
                          activeView === 'todo'
                            ? 'No pending todo items'
                            : 'No marked-as-done items',
                      }}
                    />
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
};

export default TodoList;
