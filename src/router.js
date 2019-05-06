import Vue from 'vue'
import Router from 'vue-router'
const one = () => import('./views/one/index.vue')
const two = () => import('./views/two/index.vue')
Vue.use(Router)

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '',
      redirect: '/two'
    },
    {
      path: '/one',
      component: one
    },
    {
      path: '/two',
      component: two
    }
  ]
})
