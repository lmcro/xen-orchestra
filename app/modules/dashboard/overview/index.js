'use strict';
import angular from 'angular';
import uiRouter from 'angular-ui-router'
import uiSelect from 'angular-ui-select'

import clone from 'lodash.clonedeep'
import foreach from 'lodash.foreach'

import xoApi from 'xo-api'
import xoServices from 'xo-services'

import view from './view'

export default angular.module('dashboard.overview', [
  uiRouter,
  uiSelect,
  xoApi,
  xoServices
])
  .config(function ($stateProvider) {
    $stateProvider.state('dashboard.overview', {
      controller: 'Overview as ctrl',
      url: '/overview',
      template: view
    })
  })
  .controller('Overview', function ($scope, xoApi, xo, $timeout) {

    angular.extend($scope, {
      pools: {
        nb: 0
      },
      hosts: {
        nb: 0
      },
      vms: {
        nb: 0,
        running: 0,
        halted: 0,
        action: 0
      },
      ram:[0,0],
      cpu:[0,0],
      srs: []
    })
    function populateChartsData() {

      let pools,
        vmsByContainer,
        hostsByPool,
        nb_hosts,
        nb_pools,
        vms,
        srsByHost,
        srs

      nb_pools = 0
      nb_hosts = 0
      vms = {
        nb: 0,
        states: [0, 0, 0, 0]
      }
      const runningStateToIndex = {
        Running: 0,
        Halted: 1,
        Suspended: 2,
        Action: 3
      }

      nb_pools = 0
      srs = []
      pools = xoApi.getView('pools')
      srsByHost = xoApi.getIndex('srsByContainer')
      vmsByContainer = xoApi.getIndex('vmsByContainer')
      hostsByPool = xoApi.getIndex('hostsByPool')

      foreach(pools.all, function (pool, pool_id) {
        nb_pools++
        let VMs = vmsByContainer[pool_id]
                
        foreach(VMs, function (VM) {
        // non running VM
          vms.states[runningStateToIndex[VM['power_state']]]++
          vms.nb++
        })
        let hosts = hostsByPool[pool_id]
        foreach(hosts, function (host, host_id) {
          let hosts_srs = srsByHost[host_id]
          foreach(hosts_srs, (one_srs)=>{
            one_srs = clone(one_srs)
            one_srs.host_label = host.name_label
            one_srs.pool_label = pool.name_label
            srs.push(one_srs)
            
          })
          nb_hosts++
          
          let VMs = vmsByContainer[host_id]
          foreach(VMs, function (VM) {
            vms.states[runningStateToIndex[VM['power_state']]]++
            vms.nb++
          })
        })
      })

      $scope.hosts.nb = nb_hosts
      $scope.vms = vms
      $scope.pools.nb = nb_pools
      $scope.srs = srs
      $scope.ram=[xoApi.stats.$memory.size,xoApi.stats.$memory.size - xoApi.stats.$memory.usage]
      $scope.cpu=[[xoApi.stats.$CPUs],[xoApi.stats.$vCPUs]]
    }

    populateChartsData()
    $scope.$watch(() => xoApi.all, function () {
      console.log(' XOAPI .ALL CHANGHE')
      $timeout(function () { // all semmes to be unpopulated for now 
        populateChartsData()
      }, 0)
    },
      true)

  })

  .name
