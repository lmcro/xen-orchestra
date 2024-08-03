/* eslint-env jest */

import { exec } from 'child-process-promise'
import { createReadStream } from 'fs'
import { rimraf } from 'rimraf'
import { stat, writeFile } from 'fs-extra'
import getStream from 'get-stream'
import { pFromCallback } from 'promise-toolbox'
import tmp from 'tmp'

import { ParsableFile, parseOVAFile } from './ova-read'
import readVmdkGrainTable from './vmdk-read-table'

const initialDir = process.cwd()
beforeEach(async () => {
  const dir = await pFromCallback(cb => tmp.dir(cb))
  process.chdir(dir)
})

afterEach(async () => {
  const tmpDir = process.cwd()
  process.chdir(initialDir)
  await rimraf(tmpDir)
})

export class NodeParsableFile extends ParsableFile {
  constructor(fileName, fileLength = Infinity) {
    super()
    this._fileName = fileName
    this._start = 0
    this._end = fileLength
  }

  slice(start, end) {
    const newFile = new NodeParsableFile(this._fileName)
    newFile._start = start < 0 ? this._end + start : this._start + start
    newFile._end = end < 0 ? this._end + end : this._start + end
    return newFile
  }

  async read() {
    const result = await getStream.buffer(
      createReadStream(this._fileName, {
        start: this._start,
        end: this._end - 1,
      })
    )
    // crazy stuff to get a browser-compatible ArrayBuffer from a node buffer
    // https://stackoverflow.com/a/31394257/72637
    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)
  }
}

const vmdkFileName = 'random-data.vmdk'
test('An ova file is parsed correctly', async () => {
  const ovfName = 'test.ovf'
  await writeFile(ovfName, xmlContent)
  const rawFileName = 'random-data'
  await exec(`base64 /dev/urandom | head -c 104448 > ${rawFileName}`)
  await exec(
    `rm -f ${vmdkFileName} && python /usr/lib/python3/dist-packages/VMDKstream.py ${rawFileName} ${vmdkFileName}`
  )
  const ovaName = `test.ova`
  await exec(`tar cf ${ovaName} ${ovfName} ${vmdkFileName}`)
  const vmdkParsableFile = new NodeParsableFile(vmdkFileName, (await stat(vmdkFileName)).size)
  const directGrainTableFetch = await readVmdkGrainTable(async (start, end) =>
    vmdkParsableFile.slice(start, end).read()
  )
  expect(directGrainTableFetch).toEqual(expectedResult.tables[vmdkFileName])
  const data = await parseOVAFile(new NodeParsableFile(ovaName), (buffer, encoder) => {
    return Buffer.from(buffer).toString(encoder)
  })
  for (const fileName in data.tables) {
    data.tables[fileName] = await data.tables[fileName]
  }
  expect(data).toEqual(expectedResult)
})

function arrayToBuffer(array) {
  const output = new DataView(new ArrayBuffer(array.length * 4))
  array.forEach((e, i) => {
    output.setUint32(i * 4, e, true)
  })
  return output.buffer
}

const expectedResult = {
  tables: {
    [vmdkFileName]: {
      grainFileOffsetList: arrayToBuffer([65536, 115712]),
      grainLogicalAddressList: arrayToBuffer([0, 65536]),
    },
  },
  disks: {
    vmdisk1: {
      capacity: 134217728,
      path: 'random-data.vmdk',
      descriptionLabel: 'No description',
      nameLabel: 'Hard Disk 1',
      position: 0,
    },
  },
  networks: ['LAN'],
  nameLabel: 'dsl',
  descriptionLabel: "NetworkJutsu's Damn Small Linux OVA",
  nCpus: 1,
  memory: 67108864,
}
const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!--Generated by VMware ESX Server, User: root, UTC time: 2015-09-20T04:41:19.332937Z-->
<Envelope vmw:buildId="build-2615704" xmlns="http://schemas.dmtf.org/ovf/envelope/1" xmlns:cim="http://schemas.dmtf.org/wbem/wscim/1/common" xmlns:ovf="http://schemas.dmtf.org/ovf/envelope/1" xmlns:rasd="http://schemas.dmtf.org/wbem/wscim/1/cim-schema/2/CIM_ResourceAllocationSettingData" xmlns:vmw="http://www.vmware.com/schema/ovf" xmlns:vssd="http://schemas.dmtf.org/wbem/wscim/1/cim-schema/2/CIM_VirtualSystemSettingData" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <References>
    <File ovf:href="${vmdkFileName}" ovf:id="file1" ovf:size="76934656" />
  </References>
  <DiskSection>
    <Info>Virtual disk information</Info>
    <Disk ovf:capacity="128" ovf:capacityAllocationUnits="byte * 2^20" ovf:diskId="vmdisk1" ovf:fileRef="file1" ovf:format="http://www.vmware.com/interfaces/specifications/vmdk.html#streamOptimized" ovf:populatedSize="82313216" />
  </DiskSection>
  <NetworkSection>
    <Info>The list of logical networks</Info>
    <Network ovf:name="LAN">
      <Description>The LAN network</Description>
    </Network>
  </NetworkSection>
  <VirtualSystem ovf:id="dsl">
    <Info>A virtual machine</Info>
    <Name>dsl</Name>
    <OperatingSystemSection ovf:id="1" vmw:osType="otherGuest">
      <Info>The kind of installed guest operating system</Info>
    </OperatingSystemSection>
    <VirtualHardwareSection>
      <Info>Virtual hardware requirements</Info>
      <System>
        <vssd:ElementName>Virtual Hardware Family</vssd:ElementName>
        <vssd:InstanceID>0</vssd:InstanceID>
        <vssd:VirtualSystemIdentifier>dsl</vssd:VirtualSystemIdentifier>
        <vssd:VirtualSystemType>vmx-11</vssd:VirtualSystemType>
      </System>
      <Item>
        <rasd:AllocationUnits>hertz * 10^6</rasd:AllocationUnits>
        <rasd:Description>Number of Virtual CPUs</rasd:Description>
        <rasd:ElementName>1 virtual CPU(s)</rasd:ElementName>
        <rasd:InstanceID>1</rasd:InstanceID>
        <rasd:ResourceType>3</rasd:ResourceType>
        <rasd:VirtualQuantity>1</rasd:VirtualQuantity>
      </Item>
      <Item>
        <rasd:AllocationUnits>byte * 2^20</rasd:AllocationUnits>
        <rasd:Description>Memory Size</rasd:Description>
        <rasd:ElementName>64MB of memory</rasd:ElementName>
        <rasd:InstanceID>2</rasd:InstanceID>
        <rasd:ResourceType>4</rasd:ResourceType>
        <rasd:VirtualQuantity>64</rasd:VirtualQuantity>
      </Item>
      <Item>
        <rasd:Address>1</rasd:Address>
        <rasd:Description>IDE Controller</rasd:Description>
        <rasd:ElementName>VirtualIDEController 1</rasd:ElementName>
        <rasd:InstanceID>3</rasd:InstanceID>
        <rasd:ResourceType>5</rasd:ResourceType>
      </Item>
      <Item>
        <rasd:Address>0</rasd:Address>
        <rasd:Description>IDE Controller</rasd:Description>
        <rasd:ElementName>VirtualIDEController 0</rasd:ElementName>
        <rasd:InstanceID>4</rasd:InstanceID>
        <rasd:ResourceType>5</rasd:ResourceType>
      </Item>
      <Item ovf:required="false">
        <rasd:AutomaticAllocation>false</rasd:AutomaticAllocation>
        <rasd:ElementName>VirtualVideoCard</rasd:ElementName>
        <rasd:InstanceID>5</rasd:InstanceID>
        <rasd:ResourceType>24</rasd:ResourceType>
        <vmw:Config ovf:required="false" vmw:key="enable3DSupport" vmw:value="false" />
        <vmw:Config ovf:required="false" vmw:key="enableMPTSupport" vmw:value="false" />
        <vmw:Config ovf:required="false" vmw:key="use3dRenderer" vmw:value="automatic" />
        <vmw:Config ovf:required="false" vmw:key="useAutoDetect" vmw:value="false" />
        <vmw:Config ovf:required="false" vmw:key="videoRamSizeInKB" vmw:value="4096" />
      </Item>
      <Item ovf:required="false">
        <rasd:AutomaticAllocation>false</rasd:AutomaticAllocation>
        <rasd:ElementName>VirtualVMCIDevice</rasd:ElementName>
        <rasd:InstanceID>6</rasd:InstanceID>
        <rasd:ResourceSubType>vmware.vmci</rasd:ResourceSubType>
        <rasd:ResourceType>1</rasd:ResourceType>
        <vmw:Config ovf:required="false" vmw:key="allowUnrestrictedCommunication" vmw:value="false" />
        <vmw:Config ovf:required="false" vmw:key="slotInfo.pciSlotNumber" vmw:value="33" />
      </Item>
      <Item ovf:required="false">
        <rasd:AddressOnParent>0</rasd:AddressOnParent>
        <rasd:AutomaticAllocation>false</rasd:AutomaticAllocation>
        <rasd:ElementName>CD-ROM 1</rasd:ElementName>
        <rasd:InstanceID>7</rasd:InstanceID>
        <rasd:Parent>3</rasd:Parent>
        <rasd:ResourceSubType>vmware.cdrom.remoteatapi</rasd:ResourceSubType>
        <rasd:ResourceType>15</rasd:ResourceType>
      </Item>
      <Item>
        <rasd:AddressOnParent>0</rasd:AddressOnParent>
        <rasd:ElementName>Hard Disk 1</rasd:ElementName>
        <rasd:HostResource>ovf:/disk/vmdisk1</rasd:HostResource>
        <rasd:InstanceID>8</rasd:InstanceID>
        <rasd:Parent>4</rasd:Parent>
        <rasd:ResourceType>17</rasd:ResourceType>
        <vmw:Config ovf:required="false" vmw:key="backing.writeThrough" vmw:value="false" />
      </Item>
      <Item>
        <rasd:AddressOnParent>7</rasd:AddressOnParent>
        <rasd:AutomaticAllocation>true</rasd:AutomaticAllocation>
        <rasd:Connection>LAN</rasd:Connection>
        <rasd:Description>PCNet32 ethernet adapter on "LAN"</rasd:Description>
        <rasd:ElementName>Ethernet 1</rasd:ElementName>
        <rasd:InstanceID>9</rasd:InstanceID>
        <rasd:ResourceSubType>PCNet32</rasd:ResourceSubType>
        <rasd:ResourceType>10</rasd:ResourceType>
        <vmw:Config ovf:required="false" vmw:key="slotInfo.pciSlotNumber" vmw:value="32" />
        <vmw:Config ovf:required="false" vmw:key="wakeOnLanEnabled" vmw:value="true" />
      </Item>
      <vmw:Config ovf:required="false" vmw:key="cpuHotAddEnabled" vmw:value="false" />
      <vmw:Config ovf:required="false" vmw:key="cpuHotRemoveEnabled" vmw:value="false" />
      <vmw:Config ovf:required="false" vmw:key="firmware" vmw:value="bios" />
      <vmw:Config ovf:required="false" vmw:key="virtualICH7MPresent" vmw:value="false" />
      <vmw:Config ovf:required="false" vmw:key="virtualSMCPresent" vmw:value="false" />
      <vmw:Config ovf:required="false" vmw:key="memoryHotAddEnabled" vmw:value="false" />
      <vmw:Config ovf:required="false" vmw:key="nestedHVEnabled" vmw:value="false" />
      <vmw:Config ovf:required="false" vmw:key="powerOpInfo.powerOffType" vmw:value="soft" />
      <vmw:Config ovf:required="false" vmw:key="powerOpInfo.resetType" vmw:value="soft" />
      <vmw:Config ovf:required="false" vmw:key="powerOpInfo.standbyAction" vmw:value="powerOnSuspend" />
      <vmw:Config ovf:required="false" vmw:key="powerOpInfo.suspendType" vmw:value="hard" />
      <vmw:Config ovf:required="false" vmw:key="tools.afterPowerOn" vmw:value="true" />
      <vmw:Config ovf:required="false" vmw:key="tools.afterResume" vmw:value="true" />
      <vmw:Config ovf:required="false" vmw:key="tools.beforeGuestShutdown" vmw:value="true" />
      <vmw:Config ovf:required="false" vmw:key="tools.beforeGuestStandby" vmw:value="true" />
      <vmw:Config ovf:required="false" vmw:key="tools.syncTimeWithHost" vmw:value="false" />
      <vmw:Config ovf:required="false" vmw:key="tools.toolsUpgradePolicy" vmw:value="manual" />
    </VirtualHardwareSection>
    <AnnotationSection ovf:required="false">
      <Info>A human-readable annotation</Info>
      <Annotation>NetworkJutsu's Damn Small Linux OVA</Annotation>
    </AnnotationSection>
  </VirtualSystem>
</Envelope>`