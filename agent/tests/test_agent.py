import unittest.mock as mock
from agent.shp_agent import SHPAgent


def test_agent_metrics_collection():
    agent = SHPAgent(server_url="http://localhost:8000", api_key="shp_test123")
    metrics = agent.collect_metrics()
    assert "cpu_usage" in metrics
    assert "ram_usage" in metrics
    assert "disk_usage" in metrics
    assert "hostname" in metrics
    assert "os_info" in metrics
    assert metrics["cpu_usage"] >= 0.0


def test_agent_buffering_and_flush():
    agent = SHPAgent(server_url="http://localhost:8000", api_key="shp_test123", max_buffer_size=5)

    # Mock send_payload failing
    with mock.patch.object(agent, "send_payload", return_value=False):
        agent.run_once()
        assert len(agent.buffer) >= 1

    # Mock send_payload succeeding
    with mock.patch.object(agent, "send_payload", return_value=True):
        flushed = agent.flush_buffer()
        assert flushed >= 1
        assert len(agent.buffer) == 0
