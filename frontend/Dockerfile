# 前端静态站 + /api 反代到 backend
FROM nginx:1.27-alpine

COPY frontend/ /usr/share/nginx/html/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 勿把 nginx 配置当静态页暴露也可接受；删除 html 内副本避免误下
RUN rm -f /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/Dockerfile

EXPOSE 80
