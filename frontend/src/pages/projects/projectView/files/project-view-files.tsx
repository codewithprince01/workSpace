import {
  Button,
  Card,
  Flex,
  Popconfirm,
  Segmented,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudDownloadOutlined,
  DeleteOutlined,
  SearchOutlined,
  UploadOutlined,
  FileOutlined,
  InboxOutlined,
} from '@/shared/antd-imports';
import { App, Input, Modal, Upload } from 'antd';
const { Dragger } = Upload;
import { useTranslation } from 'react-i18next';
import { durationDateFormat } from '@utils/durationDateFormat';
import { DEFAULT_PAGE_SIZE, IconsMap } from '@/shared/constants';
import {
  IProjectAttachmentsViewModel,
  ITaskAttachmentViewModel,
} from '@/types/tasks/task-attachment-view-model';
import { useAppSelector } from '@/hooks/useAppSelector';
import { attachmentsApiService } from '@/api/attachments/attachments.api.service';
import logger from '@/utils/errorLogger';
import { evt_project_files_visit } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { getBase64 } from '@/utils/file-utils';
import { themeWiseColor } from '@/utils/themeWiseColor';

const formatFileSize = (bytes: number | undefined) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ProjectViewFiles = () => {
  const { message } = App.useApp();
  useTranslation('project-view-files');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { projectId, refreshTimestamp } = useAppSelector(state => state.projectReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  
  const [attachments, setAttachments] = useState<IProjectAttachmentsViewModel>({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [viewType, setViewType] = useState('project'); // 'project' or 'task'
  const [searchText, setSearchText] = useState('');
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  const [paginationConfig, setPaginationConfig] = useState({
    total: 0,
    pageIndex: 1,
    showSizeChanger: true,
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  const fetchAttachments = useCallback(async (nextViewType = viewType, nextPage = paginationConfig.pageIndex, nextPageSize = paginationConfig.defaultPageSize) => {
    if (!projectId) return;
    try {
      setLoading(true);
      const response = await attachmentsApiService.getProjectAttachments(
        projectId,
        nextPage,
        nextPageSize,
        nextViewType
      );
      if (response.done) {
        setAttachments(response.body || { data: [], total: 0 });
        setPaginationConfig(prev => ({ ...prev, total: response.body?.total || 0 }));
      }
    } catch (error) {
      logger.error('Error fetching project attachments', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, viewType, paginationConfig.pageIndex, paginationConfig.defaultPageSize]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments, refreshTimestamp]);

  useEffect(() => {
    trackMixpanelEvent(evt_project_files_visit);
  }, [projectId]);

  const filteredData = (attachments.data || []).filter(item => {
    const matchesSearch = 
      item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.uploader_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.task_name?.toLowerCase().includes(searchText.toLowerCase());
    
    if (!matchesSearch) return false;

    return true;
  });

  const handleDelete = async (id: string) => {
    // Optimistic Update: Remove from UI immediately
    const originalData = [...(attachments.data || [])];
    setAttachments(prev => ({
      ...prev,
      data: (prev.data || []).filter(item => item.id !== id),
      total: (prev.total || 1) - 1
    }));

    try {
      const res = await attachmentsApiService.deleteAttachment(id);
      if (res.done) {
        message.success('File deleted');
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      // Rollback on failure
      setAttachments(prev => ({
        ...prev,
        data: originalData,
        total: originalData.length
      }));
      message.error('Failed to delete file');
    }
  };

  const totalBytes = (attachments.data || []).reduce((sum, item) => sum + (Number(item.size) || 0), 0);

  const handleUpload = async () => {
    if (fileList.length === 0) return;
    
    setUploading(true);
    try {
      for (const fileObj of fileList) {
        const file = fileObj.originFileObj;
        const base64 = await getBase64(file);

        // Upload through backend API only.
        await attachmentsApiService.createAttachment({
          project_id: projectId,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          file: String(base64 || ''),
          size: file.size,
        });
      }
      message.success('Files uploaded successfully.');
      setIsUploadModalOpen(false);
      setFileList([]);
      await fetchAttachments('project', 1, paginationConfig.defaultPageSize);
    } catch (error) {
      logger.error('Upload failed', error);
      message.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (fileName: string | undefined) => {
    if (!fileName) return <FileOutlined />;
    const ext = (fileName.split('.').pop()?.toLowerCase() || 'search');
    const iconName = IconsMap[ext] || 'search.png';
    return (
      <img 
        src={`/file-types/${iconName}`} 
        alt={ext} 
        style={{ width: '24px', height: '24px', objectFit: 'contain' }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/file-types/search.png';
        }}
      />
    );
  };

  const forceDownloadFile = async (url: string, fileName: string) => {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', fileName || 'file');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  };

  const columns = useMemo(() => {
    const baseColumns: TableProps<ITaskAttachmentViewModel>['columns'] = [
      {
        key: 'name',
        title: 'Name',
        sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
        render: (record: ITaskAttachmentViewModel) => (
          <Flex gap={12} align="center" style={{ cursor: 'pointer' }} onClick={() => record.url && window.open(record.url, '_blank')}>
            <div style={{ fontSize: '20px' }}>
              {getFileIcon(record.name)}
            </div>
            <Typography.Text className="file-name-text" style={{ color: '#1890ff', fontWeight: 500 }}>
              {record.name}
            </Typography.Text>
          </Flex>
        ),
      },
    ];

    if (viewType === 'task') {
      baseColumns.push({
        key: 'task',
        title: 'Task',
        width: 250,
        render: (record: ITaskAttachmentViewModel) => (
          <Typography.Text style={{ color: themeWiseColor('#595959', '#d0d0d0', themeMode) }}>
            {record.task_key ? `${record.task_key} - ${record.task_name || 'No Name'}` : '-'}
          </Typography.Text>
        ),
      });
    }

    baseColumns.push(
      {
        key: 'size',
        title: 'Size',
        width: 120,
        sorter: (a, b) => (Number(a.size) || 0) - (Number(b.size) || 0),
        render: (record: ITaskAttachmentViewModel) => (
          <Typography.Text style={{ color: themeWiseColor('#8c8c8c', '#a0a0a0', themeMode) }}>
            {formatFileSize(Number(record.size))}
          </Typography.Text>
        ),
      },
      {
        key: 'uploadedBy',
        title: 'Uploaded By',
        width: 200,
        sorter: (a, b) => (a.uploader_name || '').localeCompare(b.uploader_name || ''),
        render: (record: ITaskAttachmentViewModel) => (
          <Typography.Text style={{ color: themeWiseColor('#262626', '#d0d0d0', themeMode) }}>
            {record.uploader_name || 'N/A'}
          </Typography.Text>
        ),
      },
      {
        key: 'date',
        title: 'Date',
        width: 150,
        sorter: (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
        render: (record: ITaskAttachmentViewModel) => (
          <Typography.Text style={{ color: themeWiseColor('#8c8c8c', '#a0a0a0', themeMode) }}>
            {durationDateFormat(record.created_at)}
          </Typography.Text>
        ),
      },
      {
        key: 'actions',
        title: 'Actions',
        width: 120,
        align: 'right',
        render: (record: ITaskAttachmentViewModel) => (
          <Flex gap={12} justify="end">
            <Tooltip title="Download">
              <Button 
                  className="action-btn download-btn"
                  icon={<CloudDownloadOutlined style={{ color: themeWiseColor('#595959', '#fff', themeMode) }} />} 
                   onClick={async () => {
                     try {
                       const res = await attachmentsApiService.downloadAttachment(record.id!, record.name!);
                       if (res.done && res.body) {
                           const downloadUrl = /^https?:\/\//i.test(res.body)
                             ? res.body
                             : `http://${String(res.body).replace(/^\/+/, '')}`;
                           await forceDownloadFile(downloadUrl, record.name || 'file');
                       } else {
                         message.error('Failed to download file');
                       }
                     } catch (error) {
                       logger.error('Download failed', error);
                       message.error('Failed to download file');
                     }
                  }}
              />
            </Tooltip>
            <Popconfirm
              title="Delete this file?"
              onConfirm={() => record.id && handleDelete(record.id)}
            >
              <Tooltip title="Delete">
                <Button className="action-btn delete-btn" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Flex>
        ),
      }
    );

    return baseColumns;
  }, [viewType, attachments.data, themeMode]);

  return (
    <div style={{ padding: '0px' }}>
      <Card
        styles={{ 
            body: { padding: '24px', backgroundColor: themeWiseColor('#ffffff', '#1f1f1f', themeMode) },
            header: { 
                backgroundColor: themeWiseColor('#fafafa', '#262626', themeMode), 
                borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#333', themeMode)}` 
            }
        }}
        title={
          <Flex justify="space-between" align="center" style={{ width: '100%' }}>
            <Segmented
              options={[
                { label: 'Project Files', value: 'project' },
                { label: 'Task Attachments', value: 'task' },
              ]}
              value={viewType}
              onChange={(v) => {
                const nextViewType = v as string;
                setViewType(nextViewType);
                setAttachments({ data: [], total: 0 });
                setLoading(true);
                setPaginationConfig(prev => ({ ...prev, pageIndex: 1, total: 0 }));
              }}
              style={{ 
                  backgroundColor: themeWiseColor('#f5f5f5', '#262626', themeMode), 
                  color: themeWiseColor('#262626', '#fff', themeMode) 
              }}
            />
            
            <Flex gap={12} align="center">
              <Input
                placeholder="Search files..."
                prefix={<SearchOutlined style={{ color: themeWiseColor('#bfbfbf', '#595959', themeMode) }} />}
                style={{ 
                  width: 250, 
                  backgroundColor: themeWiseColor('#fff', '#141414', themeMode), 
                  border: `1px solid ${themeWiseColor('#d9d9d9', '#333', themeMode)}`, 
                  borderRadius: '4px', 
                  color: themeWiseColor('#262626', '#fff', themeMode) 
                }}
                onChange={(e) => setSearchText(e.target.value)}
                value={searchText}
              />
              {viewType === 'project' && (
                <Button 
                    type="primary" 
                    icon={<UploadOutlined />}
                    style={{ 
                    borderRadius: '4px', 
                    backgroundColor: '#1890ff',
                    border: 'none',
                    height: '32px',
                    fontWeight: 500
                    }}
                    onClick={() => setIsUploadModalOpen(true)}
                >
                    Upload
                </Button>
              )}
            </Flex>
          </Flex>
        }
      >
        <Typography.Text style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), fontSize: '13px', marginBottom: '16px', display: 'block' }}>
          Total Storage: {formatFileSize(totalBytes)} ({attachments.total} files)
        </Typography.Text>

        <Table<ITaskAttachmentViewModel>
          dataSource={filteredData}
          columns={columns}
          rowKey={record => record.id || ''}
          loading={loading}
          pagination={{
            ...paginationConfig,
            style: { marginTop: '24px' },
            onChange: (page, pageSize) =>
              setPaginationConfig(prev => ({ ...prev, pageIndex: page, defaultPageSize: pageSize })),
          }}
          className={themeMode === 'dark' ? 'custom-dark-table' : 'custom-light-table'}
        />
      </Card>

      <Modal
        title="Upload Files"
        open={isUploadModalOpen}
        onCancel={() => !uploading && setIsUploadModalOpen(false)}
        onOk={handleUpload}
        confirmLoading={uploading}
        okText="Upload"
        cancelText="Cancel"
        styles={{ 
            body: { backgroundColor: themeWiseColor('#fff', '#141414', themeMode) },
            header: { 
                backgroundColor: themeWiseColor('#fafafa', '#1d1d1d', themeMode), 
                borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
                color: themeWiseColor('#262626', '#fff', themeMode) 
            }
        }}
        width={600}
      >
        <div style={{ padding: '20px 0' }}>
          <Typography.Text style={{ color: '#8c8c8c', display: 'block', marginBottom: '16px' }}>
            Drag & Drop files or click to browse. Max 100 MB per file.
          </Typography.Text>
          
          <Dragger
            multiple
            fileList={fileList}
            beforeUpload={() => false} // Prevent automatic upload
            onChange={({ fileList }) => setFileList(fileList)}
            style={{ 
                backgroundColor: themeWiseColor('#fafafa', '#1d1d1d', themeMode), 
                border: `2px dashed ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
                padding: '40px'
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#1890ff', fontSize: '48px' }} />
            </p>
            <p className="ant-upload-text" style={{ color: themeWiseColor('#262626', '#d0d0d0', themeMode), fontSize: '16px', fontWeight: 500 }}>
              Drag & Drop files or click to browse
            </p>
            <p className="ant-upload-hint" style={{ color: '#8c8c8c' }}>
                PDF, images, documents, archives. Max 100 MB per file.
            </p>
          </Dragger>
        </div>
      </Modal>

      <style>{`
        .ant-modal-content, .ant-modal-header {
            background-color: ${themeWiseColor('#fff', '#1d1d1d', themeMode)} !important;
            color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
        }
        .ant-modal-title {
            color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
        }
        .ant-upload-list-item-name {
            color: ${themeWiseColor('#595959', '#d0d0d0', themeMode)} !important;
        }
        .ant-upload-list-item-action .ant-btn {
            color: #8c8c8c !important;
        }
        
        /* Table Styles */
        .custom-dark-table .ant-table, .custom-light-table .ant-table {
          background: transparent !important;
          color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
        }
        .custom-dark-table .ant-table-thead > tr > th, .custom-light-table .ant-table-thead > tr > th {
          background: ${themeWiseColor('#fafafa', '#1d1d1d', themeMode)} !important;
          color: ${themeWiseColor('#262626', '#ffffff', themeMode)} !important;
          border-bottom: 1px solid ${themeWiseColor('#f0f0f0', '#333333', themeMode)} !important;
          font-weight: 500 !important;
          padding: 12px 16px !important;
        }
        .custom-dark-table .ant-table-tbody > tr > td, .custom-light-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${themeWiseColor('#f0f0f0', '#262626', themeMode)} !important;
          padding: 12px 16px !important;
        }
        .custom-dark-table .ant-table-tbody > tr:hover > td, .custom-light-table .ant-table-tbody > tr:hover > td {
          background: ${themeWiseColor('#f5f5f5', '#1f1f1f', themeMode)} !important;
        }

        /* Pagination */
        .custom-dark-table .ant-pagination-item, .custom-light-table .ant-pagination-item {
          background: transparent !important;
          border-color: ${themeWiseColor('#d9d9d9', '#333333', themeMode)} !important;
          border-radius: 8px !important;
          width: 32px !important;
          height: 32px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .custom-dark-table .ant-pagination-item a, .custom-light-table .ant-pagination-item a {
          color: ${themeWiseColor('#8c8c8c', '#bfbfbf', themeMode)} !important;
          font-weight: 500 !important;
        }
        .custom-dark-table .ant-pagination-item-active, .custom-light-table .ant-pagination-item-active {
          border-color: #1890ff !important;
        }
        .custom-dark-table .ant-pagination-item-active a, .custom-light-table .ant-pagination-item-active a {
          color: #1890ff !important;
        }
        
        .ant-segmented {
            background: ${themeWiseColor('#f0f0f0', '#1d1d1d', themeMode)} !important;
        }
        .ant-segmented-item-selected {
            background-color: ${themeWiseColor('#fff', '#333333', themeMode)} !important;
            color: ${themeWiseColor('#1890ff', '#fff', themeMode)} !important;
        }

        /* Action Buttons */
        .action-btn {
            background: ${themeWiseColor('#fff', '#262626', themeMode)} !important;
            border: 1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)} !important;
            border-radius: 6px !important;
        }
        .delete-btn {
            color: #ff4d4f !important;
        }
        .download-btn {
            color: ${themeWiseColor('#595959', '#fff', themeMode)} !important;
        }
      `}</style>
    </div>
  );
};

export default ProjectViewFiles;
