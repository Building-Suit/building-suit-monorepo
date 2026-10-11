<script setup lang="ts">
import type { BsFinancialSystemMapCopy } from '../types/financialSystemMapCopy'
import { useOverlayState } from '@building-suit/ux'
defineProps<{ copy: BsFinancialSystemMapCopy; flows: string[]; checks: string[]; reports: string[] }>()
const { open, show, close } = useOverlayState()
</script>
<template>
          <BsButton
            type="button"
            data-testid="financial-help"
            placement="floating"
            :aria-expanded="open"
            :aria-label="copy.open"
            @click="show"
          >
            <BsInline aria-hidden="true" as="span" gap="none" :wrap="false">
              <BsIcon name="chart" :size="22" />
            </BsInline>
            <BsText as="span">{{ copy.button }}</BsText>
          </BsButton>
          <BsDialog
            :visible="open"
            :title="copy.title"
            :aria-label="copy.title"
            :show-header="false"
            size="lg"
            @update:visible="value => { if (!value) close() }"
          >
            <template #default="{ close: dismiss }">
              <BsStack as="section" gap="none" overflow="hidden">
                <BsInline as="header" gap="md" :wrap="false" align="start" surface="default">
                  <BsBox grow>
                    <BsText size="xs" emphasis="bold">{{ copy.eyebrow }}</BsText>
                    <BsHeading id="financial-map-title" :level="2" size="h3">{{ copy.title }}</BsHeading>
                    <BsText size="sm" tone="muted">{{ copy.subtitle }}</BsText>
                  </BsBox>
                  <BsButton type="button" :aria-label="copy.commonClose" size="sm" @click="dismiss">
                    <BsIcon name="close" />
                  </BsButton>
                </BsInline>
                <BsBox grow>
                  <BsFlowBlock part="diagram">
                    <BsBox aria-labelledby="financial-map-setup" as="section">
                      <BsFlowBlock part="stage-heading" state="start">
                        <BsFlowBlock part="step" as="span">{{ copy.stepsSetup }}</BsFlowBlock>
                        <BsHeading id="financial-map-setup" :level="3" size="body">{{ copy.setupTitle }}</BsHeading>
                        <BsText>{{ copy.setupBody }}</BsText>
                      </BsFlowBlock>
                      <BsFlowBlock part="branches" :columns="3" numbered>
                        <BsFlowBlock part="node" state="start">
                          <BsFlowBlock part="node-number" as="span">1.1</BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.setupOrganization }}</BsHeading>
                          <BsText>{{ copy.setupOrganizationHint }}</BsText>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" state="start">
                          <BsFlowBlock part="node-number" as="span">1.2</BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.setupAccounts }}</BsHeading>
                          <BsText>{{ copy.setupAccountsHint }}</BsText>
                          <BsLink to="/accounts" variant="flow" @click="dismiss">{{ copy.setupReviewAccounts }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" state="start">
                          <BsFlowBlock part="node-number" as="span">1.3</BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.setupCategories }}</BsHeading>
                          <BsText>{{ copy.setupCategoriesHint }}</BsText>
                          <BsLink to="/records/expense" variant="flow" @click="dismiss">{{ copy.setupFirstEntry }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                      </BsFlowBlock>
                    </BsBox>
                    <BsFlowBlock aria-hidden="true" part="arrow">
                      <BsText as="span">↓</BsText>
                    </BsFlowBlock>
                    <BsBox aria-labelledby="financial-map-inputs" as="section">
                      <BsFlowBlock part="stage-heading">
                        <BsFlowBlock part="step" as="span">{{ copy.stepsRecord }}</BsFlowBlock>
                        <BsHeading id="financial-map-inputs" :level="3" size="body">{{ copy.sourcesTitle }}</BsHeading>
                        <BsText>{{ copy.sourcesHint }}</BsText>
                      </BsFlowBlock>
                      <BsFlowBlock part="branches" :columns="3" numbered>
                        <BsFlowBlock part="node" as="article">
                          <BsFlowBlock part="node-number" as="span">2.1</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="transactions" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.manualTitle }}</BsHeading>
                          <BsText>{{ copy.manualBody }}</BsText>
                          <BsLink to="/transactions" variant="flow" @click="dismiss">{{ copy.manualLink }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" as="article" state="waiting">
                          <BsFlowBlock part="node-number" as="span">2.2</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="invoice" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.commitmentsTitle }}</BsHeading>
                          <BsText>{{ copy.commitmentsBody }}</BsText>
                          <BsFlowBlock part="callout">{{ copy.commitmentsRule }}</BsFlowBlock>
                          <BsLink to="/records/commitments" variant="flow" @click="dismiss">{{ copy.commitmentsLink }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" as="article" state="waiting">
                          <BsFlowBlock part="node-number" as="span">2.3</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="repeat" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.recurringTitle }}</BsHeading>
                          <BsText>{{ copy.recurringBody }}</BsText>
                          <BsFlowBlock part="callout">{{ copy.recurringRule }}</BsFlowBlock>
                          <BsLink to="/records/recurring" variant="flow" @click="dismiss">{{ copy.recurringLink }} <BsIcon name="arrowRight" :size="15" directional /></BsLink>
                        </BsFlowBlock>
                      </BsFlowBlock>
                      <BsFlowBlock part="subbranch">
                        <BsFlowBlock part="subbranch-label" as="p">{{ copy.manualFlowsTitle }}</BsFlowBlock>
                        <BsFlowBlock part="flow-branches">
                          <BsFlowBlock v-for="(flow, index) in flows" :key="flow" part="pill"><BsText as="span">2.1.{{ index + 1 }}</BsText>
                      {{ flow }}</BsFlowBlock>
                        </BsFlowBlock>
                      </BsFlowBlock>
                    </BsBox>
                    <BsFlowBlock aria-hidden="true" part="merge">
                      <BsText as="span">{{ copy.converges }}</BsText>
                    </BsFlowBlock>
                    <BsBox aria-labelledby="financial-map-engine" as="section">
                      <BsFlowBlock part="stage-heading">
                        <BsFlowBlock part="step" as="span">{{ copy.stepsValidate }}</BsFlowBlock>
                        <BsHeading id="financial-map-engine" :level="3" size="body">{{ copy.engineTitle }}</BsHeading>
                        <BsText>{{ copy.engineBody }}</BsText>
                      </BsFlowBlock>
                      <BsFlowBlock part="check-path">
                        <BsFlowBlock v-for="(check, index) in checks" :key="check" part="node">
                          <BsFlowBlock part="check-number" as="span">3.{{ index + 1 }}</BsFlowBlock>
                          <BsText as="span">{{ check }}</BsText>
                        </BsFlowBlock>
                      </BsFlowBlock>
                      <BsFlowBlock part="engine-result">
                        <BsIcon name="checkBadge" :size="22" />
                        <BsText as="span">{{ copy.engineResult }}</BsText>
                      </BsFlowBlock>
                    </BsBox>
                    <BsFlowBlock aria-hidden="true" part="arrow">
                      <BsText as="span">↓</BsText>
                    </BsFlowBlock>
                    <BsBox aria-labelledby="financial-map-ledger" as="section">
                      <BsFlowBlock part="stage-heading">
                        <BsFlowBlock part="step" as="span">{{ copy.stepsLedger }}</BsFlowBlock>
                        <BsHeading id="financial-map-ledger" :level="3" size="body">{{ copy.ledgerRule }}</BsHeading>
                      </BsFlowBlock>
                      <BsFlowBlock part="branches" :columns="2" numbered>
                        <BsFlowBlock part="node" as="article" state="ledger">
                          <BsFlowBlock part="node-number" as="span">4.1</BsFlowBlock>
                          <BsText size="xs" emphasis="bold">{{ copy.ledgerEventLabel }}</BsText>
                          <BsHeading :level="3" size="body">{{ copy.ledgerEvent }}</BsHeading>
                          <BsText>{{ copy.ledgerEventHint }}</BsText>
                        </BsFlowBlock>
                        <BsFlowBlock part="node" as="article" state="ledger">
                          <BsFlowBlock part="node-number" as="span">4.2</BsFlowBlock>
                          <BsText size="xs" emphasis="bold">{{ copy.ledgerLinesLabel }}</BsText>
                          <BsHeading :level="3" size="body">{{ copy.ledgerLines }}</BsHeading>
                          <BsText>{{ copy.ledgerLinesHint }}</BsText>
                        </BsFlowBlock>
                      </BsFlowBlock>
                    </BsBox>
                    <BsFlowBlock aria-hidden="true" part="split">
                      <BsText as="span">{{ copy.resultsFrom }}</BsText>
                    </BsFlowBlock>
                    <BsBox aria-labelledby="financial-map-results" as="section">
                      <BsFlowBlock part="stage-heading">
                        <BsFlowBlock part="step" as="span">{{ copy.stepsResults }}</BsFlowBlock>
                        <BsHeading id="financial-map-results" :level="3" size="body">{{ copy.resultsTitle }}</BsHeading>
                        <BsText>{{ copy.resultsHint }}</BsText>
                      </BsFlowBlock>
                      <BsFlowBlock part="branches" :columns="4" numbered>
                        <BsLink to="/accounts" @click="dismiss">
                          <BsFlowBlock part="node-number" as="span">5.1</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="wallet" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.resultsAccountsTitle }}</BsHeading>
                          <BsText>{{ copy.resultsAccountsBody }}</BsText>
                          <BsText as="span">{{ copy.resultsOpen }} <BsIcon name="arrowRight" :size="15" directional /></BsText>
                        </BsLink>
                        <BsLink to="/dashboard" @click="dismiss">
                          <BsFlowBlock part="node-number" as="span">5.2</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="dashboard" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.resultsDashboardTitle }}</BsHeading>
                          <BsText>{{ copy.resultsDashboardBody }}</BsText>
                          <BsText as="span">{{ copy.resultsOpen }} <BsIcon name="arrowRight" :size="15" directional /></BsText>
                        </BsLink>
                        <BsLink to="/reports" @click="dismiss">
                          <BsFlowBlock part="node-number" as="span">5.3</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="reports" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.resultsReportsTitle }}</BsHeading>
                          <BsText>{{ copy.resultsReportsBody }}</BsText>
                          <BsInline gap="xs" :wrap="true">
                            <BsFlowBlock v-for="report in reports" :key="report" part="pill" as="span">{{ report }}</BsFlowBlock>
                          </BsInline>
                          <BsText as="span">{{ copy.resultsOpen }} <BsIcon name="arrowRight" :size="15" directional /></BsText>
                        </BsLink>
                        <BsLink to="/transactions" @click="dismiss">
                          <BsFlowBlock part="node-number" as="span">5.4</BsFlowBlock>
                          <BsFlowBlock part="node-icon">
                            <BsIcon name="automation" />
                          </BsFlowBlock>
                          <BsHeading :level="3" size="body">{{ copy.resultsAuditTitle }}</BsHeading>
                          <BsText>{{ copy.resultsAuditBody }}</BsText>
                          <BsText as="span">{{ copy.resultsOpen }} <BsIcon name="arrowRight" :size="15" directional /></BsText>
                        </BsLink>
                      </BsFlowBlock>
                    </BsBox>
                    <BsBox as="aside" padding="lg">
                      <BsText as="strong">{{ copy.boundaryTitle }}</BsText>
                      <BsText as="span" tone="muted">{{ copy.boundaryBody }}</BsText>
                    </BsBox>
                  </BsFlowBlock>
                </BsBox>
              </BsStack>
            </template>
          </BsDialog>

</template>
