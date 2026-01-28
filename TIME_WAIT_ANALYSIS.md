# TIME_WAIT 问题分析报告

## 1. 现象分析
根据提供的 TCP 连接数监控图表：
- **TimeWait 峰值**: 约 32,677
- **Established 峰值**: 约 19,000

`TIME_WAIT` 数量远超 `ESTABLISHED` 数量，且峰值接近 32k。
`TIME_WAIT` 是 TCP 协议中**主动关闭连接**的一方进入的状态，持续时间通常为 60 秒 (2MSL)。

## 2. 风险评估
Linux 系统默认的临时端口范围 (`ip_local_port_range`) 通常较小（例如 32768 - 60999，约 2.8 万个）。
**当前 32k 的 TIME_WAIT 连接极有可能已经耗尽了服务器的可用端口资源。**
后果：
- 服务器无法向外建立新的 TCP 连接（如连接数据库、Redis、微服务等）。
- 应用程序报错：`Cannot assign requested address`。

## 3. 原因排查
由于当前代码库主要为 Vue 前端代码，问题很可能出在部署环境（Nginx）或后端服务上。

### 3.1 Nginx 反向代理配置（高频原因）
如果 Vue 项目部署在 Nginx 后，且 Nginx 配置了 `proxy_pass` 转发请求给后端应用：
- **默认行为**：Nginx 使用 HTTP/1.0 向后端发起连接，且默认不开启 Keep-Alive。这意味着每个请求 Nginx 都会与后端建立一个新连接，并在请求完成后**主动关闭**。
- **结果**：Nginx 服务器上会出现大量指向后端的 `TIME_WAIT` 连接。

### 3.2 服务端/客户端未开启 Keep-Alive
- 如果是后端服务之间的调用（如微服务），调用方使用了短连接（每次请求新建连接）。
- 如果是前端发起的请求，通常浏览器默认开启 Keep-Alive，但如果服务端配置强制关闭连接（`Connection: close`），则会导致大量连接关闭。

## 4. 解决方案

### 4.1 优化 Nginx 配置（推荐）
如果使用了 Nginx 反向代理，请确保开启对 Upstream 的长连接：

```nginx
upstream backend_server {
    server 127.0.0.1:8080;
    keepalive 32; # 关键：保持的空闲长连接数量
}

server {
    location /api/ {
        proxy_pass http://backend_server;
        
        # 关键：启用 HTTP/1.1 并清除 Connection 头
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

### 4.2 调整内核参数
在 `/etc/sysctl.conf` 中添加或修改以下配置，然后执行 `sysctl -p` 生效：

1.  **开启 TIME_WAIT 重用 (Safe & Recommended)**
    ```bash
    net.ipv4.tcp_tw_reuse = 1
    ```
    允许将处于 `TIME_WAIT` 状态的 socket 重新用于新的主动连接（主要解决客户端/反向代理端口耗尽问题）。

2.  **扩大本地端口范围**
    ```bash
    net.ipv4.ip_local_port_range = 1024 65535
    ```
    增加可用端口数量，缓解端口耗尽。

3.  **调整 TIME_WAIT 最大桶数**
    ```bash
    net.ipv4.tcp_max_tw_buckets = 50000
    ```
    如果 TIME_WAIT 数量超过此值，系统将强制清除多余的连接并打印警告（作为兜底措施）。

### 4.3 检查代码逻辑
虽然当前前端代码未发现问题，但建议检查后端代码：
- 确保 HTTP Client（如 HttpClient, RestTemplate, Axios Node.js）使用了连接池。
- 避免在循环中频繁创建和销毁连接。
