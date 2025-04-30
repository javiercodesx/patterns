import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
import {
  PatientRepresentativesRepositoryService,
  PendingActionsRepositoryService,
  UsersRepositoryService,
} from '@gestiar/backend/repositories';
import {
  IGenerateUsersPendingActions,
  PatientRepresentatives,
  PatientRepresentativesStatusEnum,
  PendingActions,
  PendingActionType,
  Users,
} from '@gestiar/backend/resources';
import { CrudRequest } from '@nestjsx/crud';
import { OrdersService } from '../orders/orders.service';
import { PendingActionsService } from '../pending-actions/pending-actions.service';
import { calculateUnderage } from '../utils/utils';
import moment = require('moment');

@Injectable()
export class PatientRepresentativesService extends TypeOrmCrudService<PatientRepresentatives> {

  // Con el constructor inyecto los repositorios de PatientRepresentatives, Users, PendingActions y Orders.
  // También inyecto el servicio de PendingActionsService, que se encarga de generar los pending actions.
  // También inyecto el servicio de OrdersService, que se encarga de actualizar las ordenes de un paciente.
  // También inyecto el servicio de UsersRepositoryService, que se encarga de obtener los usuarios.
  // También inyecto el servicio de PendingActionsRepositoryService, que se encarga de obtener los pending actions.
  // También inyecto el servicio de OrdersService, que se encarga de actualizar las ordenes de un paciente.
  
  constructor(
    @InjectRepository(PatientRepresentatives)
    private repository: PatientRepresentativesRepositoryService,
    @InjectRepository(Users)
    private usersRepositoryService: UsersRepositoryService,
    @InjectRepository(PendingActions)
    private pendingActionsRepositoryService: PendingActionsRepositoryService,
    private ordersService: OrdersService,
    private pendingActionsService: PendingActionsService
  ) {
    super(repository);
  }

  // Esta funcion getRepresented es la funcion que se encarga de obtener los pacientes representados por un usuario.
  // Lo primero que hace es buscar en el repositorio de PatientRepresentatives los pacientes representados por un usuario por medio del ID del perfil del usuario.
  // Luego se agrega un filtro para que que si el usuario fue borrado logicamente no sea devuelto.
  // Finalmente se retorna el array de pacientes representados.
  async getRepresented(
    patientProfileMe: string
  ): Promise<PatientRepresentatives[]> {
    let result = await this.repository.find({
      where: {
        uuidPatProfRepresentative: patientProfileMe,
        status: PatientRepresentativesStatusEnum.approved,
      },
      withDeleted: false,
      relations: ['patientProfile', 'patientProfile.user'],
    });

    // se agrega este filtro para que que si el usuario fue borrado logicamente no sea devuelto
    result = result.filter((f) => {
      return f.patientProfile !== null;
    });

    return result.map((m) => {
      delete m.patientProfile.user.password;
      return m;
    });
  }

  // Esta funcion getRepresetatives es la funcion que se encarga de obtener los apoderados de un paciente.
  // Lo primero que hace es buscar en el repositorio de PatientRepresentatives los apoderados de un paciente por medio del ID del perfil del paciente.
  // Luego se agrega un filtro para que que si el usuario fue borrado logicamente no sea devuelto.
  // Finalmente se retorna el array de apoderados.
  async getRepresetatives(
    patientProfileMe: string
  ): Promise<PatientRepresentatives[]> {
    let result = await this.repository.find({
      where: {
        uuidPatProf: patientProfileMe,
      },
      withDeleted: false,
      relations: ['patProfRepresentative', 'patProfRepresentative.user'],
    });

    // se agrega este filtro para que que si el usuario fue borrado logicamente no sea devuelto
    result = result.filter((f) => f.patProfRepresentative !== null);

    return result.map((m) => {
      delete m.patProfRepresentative.user.password;
      return m;
    });
  }

  // Esta funcion createRepresetatives es la funcion que se encarga de crear un apoderado para un paciente.
  // Lo primero que hace es buscar en users el usuario por medio del DNI, haciendo un left join con patientProfile para obtener el perfil del paciente.
  // Despues verifica si el usuario es menor de 18 años.
  // Si es menor de 18 años, se lanza una excepcion.
  // Luego en patientRepresentatives se busca el apoderado por medio del ID del perfil del paciente y el DNI del apoderado y se hace un left join con patientProfiles para obtener el perfil del apoderado.
  // El status del invite pasa a ser requested.
  // Se guarda el invite en la base de datos.
  // Se restaura el invite en la base de datos.
  // Se genera un pending action para que el apoderado acepte la solicitud.
  // En el return se utiliza getRepresetatives para obtener el array de apoderados, es decir personas que son representadas por el usuario que está realizando la acción.
  async createRepresetatives(
    mePatientProfileId: string,
    dni: string
  ): Promise<PatientRepresentatives[]> {
    const user = await this.usersRepositoryService.findOne({
      where: { identity: dni },
      relations: ['patientProfile'],
    });
    const isUnderage = moment()
      .subtract(18, 'years')
      .isBefore(moment(user.birthdate));
    if (isUnderage) {
      this.throwBadRequestException("El usuario es menor, no puede agregarlo como su apoderado.");
      return;
    }
    let invite = await this.repository.findOne({
      where: {
        uuidPatProf: mePatientProfileId,
        patProfRepresentative: { user: { identity: dni } },
      },
      relations: ['patProfRepresentative', 'patProfRepresentative.user'],

      withDeleted: true,
    });
    if (invite) {
      this.checkRepresentativeStatus(invite);
      invite.status = PatientRepresentativesStatusEnum.requested;
      await this.repository.save(invite);
      await this.repository.restore({
        uuid: invite.uuid,
      });
    } else {
      if (!user || !user.patientProfile) {
        throw this.throwBadRequestException(
          'No encontramos a ningún usuario existente con ese DNI'
        );
      }
      if (user && user.patientProfile?.uuid === mePatientProfileId) {
        throw this.throwBadRequestException(
          'No puedes agregarte a ti mismo como apoderado'
        );
      }
      invite = await this.repository.save({
        uuidPatProf: mePatientProfileId,
        uuidPatProfRepresentative: user.patientProfile.uuid,
        status: PatientRepresentativesStatusEnum.requested,
      });
    }
    // se busca el pending action por medio del ID del perfil del paciente que está realizando la acción y el ID del perfil del apoderado.
    let pendingAction = await this.pendingActionsRepositoryService.find({
      where: {
        uuidPatientProfileSender: mePatientProfileId,
        uuidPatientProfile: invite.uuidPatProfRepresentative,
      },
    });
    if (pendingAction.length) {
      await this.pendingActionsService.resendPendingActions(pendingAction);
    } else {
      const userMe = await this.usersRepositoryService.findOne({
        where: { patientProfile: { uuid: mePatientProfileId } },
        relations: ['patientProfile'],
      });
      // se genera un pending action para que el apoderado acepte la solicitud.
      const data: IGenerateUsersPendingActions = {
        user: userMe,
        actionType: PendingActionType.approveRepresented,
        invite,
      };

      await this.pendingActionsService.generateUsersPendingActions(data);
    }

    return await this.getRepresetatives(mePatientProfileId);
  }
  // El mePatientProfileId hace referencia al ID del perfil del paciente que está realizando la acción,
  // uuidPatientRepresentativeId hace referencia al ID del perfil del apoderado que se desea eliminar.
  // Lo que hace removeRepresetatives es eliminar un apoderado de un paciente, lo hace por medio de un ID de un perfil de paciente.
  // Primero en el repositorio de PatientRepresentatives se busca el apoderado por medio del ID del perfil de paciente.
  // Luego se actualiza el estado del apoderado a removido.
  // Luego se guarda el apoderado en la base de datos.
  // Luego se elimina el apoderado de la base de datos.
  // Finalmente retorna el array de apoderados.
  async removeRepresetatives(
    mePatientProfileId: string,
    uuidPatientRepresentativeId: string
  ): Promise<PatientRepresentatives[]> {
    const invite = await this.repository.findOneBy({
      uuid: uuidPatientRepresentativeId,
    });
    await this.ordersService.updateOrdersByPatientRepresentative(
      invite.uuidPatProfRepresentative
    );
    if (invite) {
      invite.status = PatientRepresentativesStatusEnum.removed;
      await this.repository.save(invite);
      await this.repository.softDelete({ uuid: invite.uuid });
    }
    // se busca el usuario por medio del ID del perfil del paciente que está realizando la acción.
    const user = await this.usersRepositoryService.findOne({
      where: { patientProfile: { uuid: mePatientProfileId } },
      relations: ['patientProfile'],
    });

    const representatives = await this.getRepresetatives(mePatientProfileId);

    await this.handleUnderageUser(user, representatives);

    return representatives;
  }

  // Lo que hace removeRepreseted es eliminar un apoderado de un paciente, lo hace por medio de un ID de un perfil de paciente.
  // Primero lo busca en la base de datos por medio del ID del perfil de paciente.
  // Luego actualiza el estado del apoderado a removido.
  // Luego guarda el apoderado en la base de datos.
  // Luego elimina el apoderado de la base de datos.
  // Luego guarda el apoderado en la base de datos.
  // Finalmente retorna el array de apoderados.
  async removeRepreseted(
    mePatientProfileId: string,
    uuidPatientRepresentativeId: string
  ): Promise<PatientRepresentatives[]> {
    const invite = await this.repository.findOneBy({
      uuid: uuidPatientRepresentativeId,
    });
    await this.ordersService.updateOrdersByPatientRepresentative(
      mePatientProfileId
    );
    if (invite) {
      invite.status = PatientRepresentativesStatusEnum.removed;
      await this.repository.save(invite);
      await this.repository.softDelete({ uuid: invite.uuid });
      await this.repository.save(invite);
    }
    // se busca el usuario por medio del ID del perfil del paciente que está realizando la acción.
    const user = await this.usersRepositoryService.findOne({
      where: { patientProfile: { uuid: invite.uuidPatProf } },
      relations: ['patientProfile'],
    });
    const representatives = await this.getRepresetatives(mePatientProfileId);

    await this.handleUnderageUser(user, representatives);

    return representatives;
  }
  
  // overrride es una funcion nativa de nestjs que se encarga de eliminar un registro de la base de datos.
  // con deleteOne lo que hago es sobreescribir la funcion para que cuando se elimine un registro, se haga un soft delete.
  // un soft delete es un delete logico, es decir, no se elimina fisicamente dela base de datos, sino que se marca como eliminado.
  // esto es util para cuando se quiere eliminar un registro, pero se quiere mantener el historial de eliminaciones.

  override deleteOne(req: CrudRequest): Promise<void | PatientRepresentatives> {
    req.options.query.softDelete = true;
    return super.deleteOne(req);
  }

  private checkRepresentativeStatus(invite: PatientRepresentatives): void {
    if (invite.status === PatientRepresentativesStatusEnum.requested) {
      throw new BadRequestException(
        'Ya enviaste una solicitud a esta persona para que sea tu apoderado. La solicitud está pendiente de confirmación.'
      );
    }
    if (invite.status === PatientRepresentativesStatusEnum.approved) {
      throw new BadRequestException('Este apoderado ya está registrado.');
    }
  }
  // Por lo tanto esta funcion lo que hace es verificar si el usuario que está realizando la acción tiene representados pacientes menores de 18 años.
  // el user hace referencia al usuario que está realizando la acción, por lo tanto es un objeto que contiene datos del usuario que está realizando la acción.
  // representatives hace referencia a un array de objetos que contiene los pacientes que son representados por el usuario que está realizando la acción.  
  private async checkUnderangeRepresentatives(
    user: Users,
    representatives: PatientRepresentatives[]
  ) {
    if (!representatives.length) {
      await this.pendingActionsService.generateUsersPendingActions({
        user,
        actionType: PendingActionType.addUnderageRepresentative,
      });
    }
  }

  // Esta funcion lo que hace es verificar si el usuario que está realizando la acción tiene representados pacientes menores de 18 años.
  private async handleUnderageUser(
    user: Users,
    representatives: PatientRepresentatives[]
  ): Promise<void> {
    const isUnderage = calculateUnderage(user.birthdate);
    if (isUnderage) {
      await this.checkUnderangeRepresentatives(user, representatives);
    }
  }
}
