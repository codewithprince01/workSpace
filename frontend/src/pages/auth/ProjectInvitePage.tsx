import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Result, Spin, Typography, theme } from 'antd';
import { CheckCircleOutlined, ProjectOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';

interface InviteInfo {
  project_name: string;
  inviter_name: string;
  role: string;
  email: string;
  expires_at: string;
  token: string;
}

const ProjectInvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { token: themeToken } = theme.useToken();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Fetch invite details
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await axios.get(`/api/projects/invite/${token}`);
        if (res.data?.done) {
          setInfo(res.data.body);
        } else {
          setError(res.data?.message || 'Invalid invite link.');
        }
      } catch (err: any) {
        setError(
          err?.response?.data?.message || 'This invite link is invalid or has expired.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    try {
      setAccepting(true);
      const res = await axios.post(
        '/api/projects/invite/accept',
        { token },
        { withCredentials: true }
      );
      if (res.data?.done) {
        setAccepted(true);
      } else {
        setError(res.data?.message || 'Failed to accept invite.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || '';
      // If user is not logged in, redirect to login with return URL
      if (err?.response?.status === 401) {
        navigate(`/auth/login?redirect=/worklenz/invite/project/${token}`);
        return;
      }
      setError(msg || 'Failed to accept invite. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: themeToken.colorBgLayout,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // ─── Accepted ─────────────────────────────────────────────────────────────
  if (accepted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: themeToken.colorBgLayout,
        }}
      >
        <Result
          status="success"
          title="You've joined the project!"
          subTitle={`You now have access to "${info?.project_name}". Redirecting...`}
          extra={
            <Button type="primary" onClick={() => navigate('/worklenz/home')}>
              Go to Home
            </Button>
          }
        />
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: themeToken.colorBgLayout,
        }}
      >
        <Result
          status="error"
          title="Invite Not Found"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate('/auth/login')}>
              Go to Login
            </Button>
          }
        />
      </div>
    );
  }

  // ─── Main invite card ─────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themeToken.colorBgLayout,
        padding: '24px',
      }}
    >
      <div
        style={{
          background: themeToken.colorBgElevated,
          border: `1px solid ${themeToken.colorBorderSecondary}`,
          borderRadius: themeToken.borderRadiusLG * 2,
          padding: '48px 40px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          boxShadow: themeToken.boxShadowTertiary,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            backgroundColor: themeToken.colorPrimaryBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          <ProjectOutlined
            style={{ fontSize: 32, color: themeToken.colorPrimary }}
          />
        </div>

        {/* Heading */}
        <Typography.Title level={3} style={{ marginBottom: 8 }}>
          You're invited!
        </Typography.Title>

        <Typography.Paragraph
          style={{
            color: themeToken.colorTextSecondary,
            fontSize: 15,
            marginBottom: 32,
          }}
        >
          <Typography.Text strong style={{ color: themeToken.colorText }}>
            {info?.inviter_name}
          </Typography.Text>{' '}
          has invited you to join{' '}
          <Typography.Text strong style={{ color: themeToken.colorPrimary }}>
            {info?.project_name}
          </Typography.Text>{' '}
          as a{' '}
          <Typography.Text strong style={{ color: themeToken.colorText }}>
            {info?.role}
          </Typography.Text>
          .
        </Typography.Paragraph>

        {/* Details */}
        <div
          style={{
            background: themeToken.colorBgContainer,
            border: `1px solid ${themeToken.colorBorderSecondary}`,
            borderRadius: themeToken.borderRadius,
            padding: '16px 20px',
            marginBottom: 32,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <ProjectOutlined style={{ color: themeToken.colorPrimary }} />
            <Typography.Text style={{ color: themeToken.colorTextSecondary }}>
              Project:
            </Typography.Text>
            <Typography.Text strong>{info?.project_name}</Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserOutlined style={{ color: themeToken.colorPrimary }} />
            <Typography.Text style={{ color: themeToken.colorTextSecondary }}>
              Role:
            </Typography.Text>
            <Typography.Text strong style={{ textTransform: 'capitalize' }}>
              {info?.role}
            </Typography.Text>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button size="large" onClick={() => navigate('/worklenz/home')}>
            Decline
          </Button>
          <Button
            size="large"
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={accepting}
            onClick={handleAccept}
          >
            Accept & Join
          </Button>
        </div>

        <Typography.Text
          style={{
            display: 'block',
            marginTop: 24,
            fontSize: 12,
            color: themeToken.colorTextQuaternary,
          }}
        >
          Expires: {info?.expires_at ? new Date(info.expires_at).toLocaleDateString() : 'N/A'}
        </Typography.Text>
      </div>
    </div>
  );
};

export default ProjectInvitePage;
