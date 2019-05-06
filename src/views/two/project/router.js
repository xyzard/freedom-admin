import Vue from 'vue'
import Router from 'vue-router'
const Float = () => import('./components/float/index.vue')
const Fly = () => import('./components/fly/index.vue')
// import Float from './components/float/index.vue'
// import Fly from './components/fly/index.vue'
Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '',
      redirect: '/float'
    },
    {
      path: '/float',
      component: Float
    },
    {
      path: '/fly',
      component: Fly
    }
  ]
})
